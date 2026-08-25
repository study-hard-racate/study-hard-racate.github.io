/* csim.js —— 自定义 C 代码（数组排序 / 链表）解释执行仿真器
 *
 * 数组模式：int 一维数组（声明/参数/初值）、for / while / do-while、if/else、
 *       return / break / continue、赋值与复合赋值、算术/比较/逻辑/位运算、
 *       数组下标读写、&a[i] 取址（仅限交换调用）、自定义函数调用（含递归）、
 *       swap(&a[i], &a[j]) 特判、#include 忽略、main 与算法函数联动。
 * 链表模式（代码含 struct 定义时自动切换）：真实执行 main；
 *       struct Node 定义、malloc(sizeof(struct X))、p->data / p->next、
 *       &head 与 struct Node ** 参数、NULL、sizeof、(struct X *) 强转；
 *       链表快照 { ids, data, ptrs, cur } 附在每个步骤上。
 * 不支持（中文报错 + 行号）：scanf/gets、全局变量、free、指针算术；printf/puts 输出自动跳过（打印函数可保留）。
 *
 * 用法：var res = CSim.run(codeText, { size: 8, forceRandom: false });
 *   res.ok === true  → res.lines（原始代码行）, res.steps, res.stats, res.mode
 *   res.ok === false → res.error = { line, msg }（中文提示）
 *
 * 步骤契约：{ line, arr, msg, cmp?, swap?, done?, list? }
 *   line 为源文件原始行号（1..N，-1 表示结束），arr 为主数组快照（链表模式为 null）。
 *   链表模式额外携带 list 快照，由 list.js 渲染。
 */
(function (global) {
  "use strict";

  function CSimError(line, msg) {
    this.line = line;
    this.msg = msg;
  }

  /* ---------------- 词法分析 ---------------- */

  var MULTI_OPS = ["++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=",
    "<=", ">=", "&&", "||", "<<", ">>", "&=", "|=", "^=", "->"];

  function tokenize(src) {
    var tokens = [];
    var lines = src.split(/\r?\n/);
    var n = src.length, i = 0, line = 1;
    while (i < n) {
      var ch = src[i];
      if (ch === "\n") { line++; i++; continue; }
      if (ch === " " || ch === "\t" || ch === "\r") { i++; continue; }
      if (ch === "#") { while (i < n && src[i] !== "\n") i++; continue; }
      if (ch === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (ch === "/" && src[i + 1] === "*") {
        i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
          if (src[i] === "\n") line++;
          i++;
        }
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        while (i < n && src[i] !== '"') i++; /* 字符串内容不展开，遇到即报错 */
        i++;
        tokens.push({ t: "str", v: "", line: line });
        continue;
      }
      if (ch >= "0" && ch <= "9") {
        var st = i;
        if (ch === "0" && (src[i + 1] === "x" || src[i + 1] === "X")) {
          i += 2;
          while (i < n && /[0-9a-fA-F]/.test(src[i])) i++;
        } else {
          while (i < n && /[0-9]/.test(src[i])) i++;
        }
        tokens.push({ t: "num", v: src.slice(st, i), line: line });
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var s = "";
        while (i < n && /[A-Za-z0-9_]/.test(src[i])) { s += src[i]; i++; }
        tokens.push({ t: "id", v: s, line: line });
        continue;
      }
      var two = src.substr(i, 2);
      if (MULTI_OPS.indexOf(two) >= 0) {
        tokens.push({ t: "op", v: two, line: line });
        i += 2;
        continue;
      }
      if ("(){}[];,=+-*/%<>!&|^~?:".indexOf(ch) >= 0) {
        var t = "op";
        if (ch === "(") t = "lparen";
        else if (ch === ")") t = "rparen";
        else if (ch === "{") t = "lbrace";
        else if (ch === "}") t = "rbrace";
        else if (ch === "[") t = "lbrack";
        else if (ch === "]") t = "rbrack";
        else if (ch === ";") t = "semi";
        else if (ch === ",") t = "comma";
        tokens.push({ t: t, v: ch, line: line });
        i++;
        continue;
      }
      tokens.push({ t: "op", v: ch, line: line });
      i++;
    }
    return { tokens: tokens, lines: lines };
  }

  /* ---------------- 语法分析 ---------------- */

  var TYPE_IDS = { int: 1, void: 1, char: 1, const: 1 };

  function Parser(toks) {
    this.toks = toks;
    this.p = 0;
    this.structs = {};   /* 结构体名 → {name, fields, line} */
    this.typedefs = {};  /* typedef 别名 → 结构体名 */
    this.hasPtrArray = false; /* 指针数组（图邻接表） */
  }

  Parser.prototype.peek = function () {
    return this.toks[this.p] || null;
  };

  Parser.prototype.eat = function () {
    var t = this.toks[this.p];
    if (t) this.p++;
    return t;
  };

  Parser.prototype.desc = function (t) {
    if (!t) return "代码结束";
    switch (t.t) {
      case "num": return "数字 " + t.v;
      case "id": return "'" + t.v + "'";
      case "str": return "字符串常量（仅用于 printf/puts，输出自动跳过）";
      default: return "'" + t.v + "'";
    }
  };

  Parser.prototype.err = function (msg, line) {
    throw new CSimError(line, msg);
  };

  Parser.prototype.expectOp = function (v) {
    var t = this.peek();
    if (t && t.v === v) return this.eat();
    this.err("期望 '" + v + "'，实际是 " + this.desc(t), t ? t.line : 1);
  };

  /* 类型：{kind:"int"|"void"|"char"|"struct", structName?, ptr: n}
     ptr 为指针层数（int *a → ptr:1；struct Node **h → ptr:2） */
  Parser.prototype.parseType = function () {
    var t = this.peek();
    if (!t || t.t !== "id") this.err("期望类型（int / void / struct），实际是 " + this.desc(t), t ? t.line : 1);
    if (t.v === "int" || t.v === "void" || t.v === "char") {
      this.eat();
      var ptr = 0;
      while (this.peek().t === "op" && this.peek().v === "*") { this.eat(); ptr++; }
      return { kind: t.v, ptr: ptr };
    }
    if (t.v === "const") {
      this.eat();
      var n = this.peek();
      if (n && n.t === "id" && n.v === "int") { this.eat(); return { kind: "int", ptr: 0 }; }
      this.err("const 后仅支持 int", n ? n.line : t.line);
    }
    if (t.v === "struct") {
      this.eat();
      var nt = this.peek();
      if (!nt || nt.t !== "id") this.err("struct 后需要类型名（如 struct Node）", nt ? nt.line : t.line);
      this.eat();
      var ptr2 = 0;
      while (this.peek().t === "op" && this.peek().v === "*") { this.eat(); ptr2++; }
      return { kind: "struct", structName: nt.v, ptr: ptr2 };
    }
    if (t.v in this.typedefs) {
      /* typedef struct ListNode {...} ListNode; 的别名 */
      this.eat();
      var ptr3 = 0;
      while (this.peek().t === "op" && this.peek().v === "*") { this.eat(); ptr3++; }
      return { kind: "struct", structName: this.typedefs[t.v], ptr: ptr3 };
    }
    if (t.v === "union") this.err("暂不支持 union，请使用 struct", t.line);
    if (t.v === "float" || t.v === "double" || t.v === "long" || t.v === "short" || t.v === "unsigned") {
      this.err("暂不支持类型 " + t.v + "，请全部使用 int / struct", t.line);
    }
    this.err("期望类型（int / void），实际是 " + this.desc(t), t.line);
  };

  /* 顶层：函数定义、struct 定义、typedef 定义 */
  Parser.prototype.parseProgram = function () {
    var funcs = [];
    while (this.p < this.toks.length) {
      var t = this.peek();
      if (t.t === "semi") { this.eat(); continue; }
      if (t.t === "id" && t.v === "typedef") {
        this.parseTypedefDef();
        continue;
      }
      if (t.t === "id" && t.v === "struct") {
        /* struct Name { ... }; 是定义；struct Name *f(...) 是函数定义 */
        var n1 = this.toks[this.p + 1];
        var n2 = this.toks[this.p + 2];
        if (n1 && n1.t === "id" && n2 && n2.t === "lbrace") {
          this.parseStructDef();
          continue;
        }
      }
      funcs.push(this.parseFunc());
    }
    if (!funcs.length) this.err("未找到任何函数定义", 1);
    return { funcs: funcs, structs: this.structs, hasPtrArray: this.hasPtrArray };
  };

  /* struct 字段表：int 字段 / struct 指针字段 / int 数组字段（如 MinStack 的 data[]） */
  Parser.prototype.parseFields = function (ctx) {
    var fields = [];
    while (true) {
      if (this.peek().t === "rbrace") { this.eat(); break; }
      var ft = this.parseType();
      var fname = this.eat();
      if (!fname || fname.t !== "id") this.err("结构体字段名有误", fname ? fname.line : 1);
      if (ft.kind === "struct" && ft.ptr === 0) {
        this.err("结构体字段仅支持 int 或结构体指针（如 struct Node *next）", fname.line);
      }
      if (ft.kind === "void") this.err("结构体字段不能是 void", fname.line);
      var field = { name: fname.v, type: ft };
      if (this.peek().t === "lbrack") {
        /* 数组字段：int data[N];（大小取数字，宏/变量按 100 处理） */
        if (ft.kind !== "int" || ft.ptr > 0) {
          this.err("数组字段暂仅支持 int 数组（如 int data[100]）", fname.line);
        }
        this.eat();
        var szTok = this.peek();
        var sz = 100;
        if (szTok.t === "num") { sz = Math.min(Number(szTok.v) || 100, 500); this.eat(); }
        else if (szTok.t !== "rbrack") {
          /* 大小是标识符（宏等）：按默认长度，跳过到 ] */
          while (this.peek().t !== "rbrack" && this.peek().t !== "rbrace") this.eat();
        }
        this.expectRBrack();
        field.isArrayField = true;
        field.arrSize = sz;
      }
      fields.push(field);
      if (this.peek().t === "semi") { this.eat(); continue; }
      this.err("结构体字段后缺少 ';'", this.peek() ? this.peek().line : 1);
    }
    return fields;
  };

  /* typedef struct ListNode { int val; struct ListNode *next; } ListNode; */
  Parser.prototype.parseTypedefDef = function () {
    var st = this.peek();
    this.eat(); /* typedef */
    var t = this.peek();
    if (!(t.t === "id" && t.v === "struct")) {
      this.err("typedef 目前仅支持结构体：typedef struct X {...} 别名;", t ? t.line : 1);
    }
    this.eat(); /* struct */
    /* 结构体名可选（匿名 struct 时用别名当名字） */
    var nameTok = null;
    var p1 = this.peek();
    if (p1.t === "id" && this.toks[this.p + 1] && this.toks[this.p + 1].t === "lbrace") {
      nameTok = this.eat();
      this.eat(); /* { */
    } else if (p1.t === "lbrace") {
      this.eat();
    } else {
      this.err("typedef struct 后需要结构体名或 '{'", p1 ? p1.line : 1);
    }
    var fields = this.parseFields("typedef");
    var aliasTok = this.eat();
    if (!aliasTok || aliasTok.t !== "id") {
      this.err("typedef 末尾需要别名，如 } ListNode;", aliasTok ? aliasTok.line : 1);
    }
    if (this.peek().t === "semi") this.eat();
    var inner = nameTok ? nameTok.v : aliasTok.v;
    this.typedefs[aliasTok.v] = inner;
    if (nameTok) this.structs[inner] = { name: inner, fields: fields, line: st.line };
    else this.structs[inner] = { name: inner, fields: fields, line: st.line };
    return inner;
  };

  /* struct Node { int data; struct Node *next; }; */
  Parser.prototype.parseStructDef = function () {
    var st = this.peek();
    this.eat(); /* struct */
    var nameTok = this.eat();
    if (!nameTok || nameTok.t !== "id") this.err("struct 后需要类型名", nameTok ? nameTok.line : 1);
    if (this.peek().t !== "lbrace") {
      /* struct Node; 前向声明 / struct Node *p; 全局变量 → 报错 */
      this.err("暂不支持结构体变量声明与全局变量，请用 malloc 创建节点；若为前向声明请直接写完整定义", nameTok.line);
    }
    this.eat();
    var fields = this.parseFields("struct");
    if (this.peek().t === "semi") this.eat();
    this.structs[nameTok.v] = { name: nameTok.v, fields: fields, line: st.line };
    return { name: nameTok.v, fields: fields, line: st.line };
  };

  Parser.prototype.parseFunc = function () {
    this.parseType();
    var nameTok = this.eat();
    if (!nameTok || nameTok.t !== "id") this.err("期望函数名，实际是 " + this.desc(nameTok), nameTok ? nameTok.line : 1);
    if (this.peek().t !== "lparen") this.err("期望 '('（只支持函数定义，不支持全局变量）", nameTok.line);
    var params = this.parseParams();
    var body = this.parseBlock();
    var f = {
      name: nameTok.v,
      params: params,
      body: body,
      line: nameTok.line,
      hasArray: params.some(function (p) { return p.isArray; }),
      arrayDecls: [],
    };
    collectArrayDecls(body, f.arrayDecls);
    if (f.arrayDecls.length) f.hasArray = true;
    return f;
  };

  Parser.prototype.parseParams = function () {
    var t = this.peek();
    if (t.t === "lparen") this.eat(); else this.err("期望 '('", t ? t.line : 1);
    var params = [];
    var done = false;
    while (true) {
      if (this.peek().t === "rparen") { this.eat(); done = true; break; }
      if (this.peek().t === "id" && this.peek().v === "void" &&
          this.toks[this.p + 1] && this.toks[this.p + 1].t === "rparen") {
        /* (void) 表示空参数表 */
        this.eat();
        this.eat();
        done = true;
        break;
      }
      var type = this.parseType();
      var isArray = false;
      var isPointer = type.ptr > 0 || type.kind === "struct";
      var nameTok = this.eat();
      if (!nameTok || nameTok.t !== "id") this.err("期望参数名，实际是 " + this.desc(nameTok), nameTok ? nameTok.line : 1);
      var p2 = this.peek();
      if (p2.t === "lbrack") {
        this.eat();
        isArray = true;
        if (this.peek().t !== "rbrack") {
          /* 参数数组的长度被忽略：int a[10] ≡ int a[] */
          this.eatExprUntil("rbrack");
        }
        this.expectRBrack();
      }
      params.push({ name: nameTok.v, isArray: isArray, isPointer: isPointer, isStructPtr: type.kind === "struct", type: type });
      if (this.peek().t === "comma") { this.eat(); continue; }
      break;
    }
    if (!done) {
      if (this.peek().t !== "rparen") this.err("期望 ')'", this.peek() ? this.peek().line : 1);
      this.eat();
    }
    return params;
  };

  Parser.prototype.expectRBrack = function () {
    var t = this.peek();
    if (t.t === "rbrack") { this.eat(); return; }
    this.err("期望 ']'", t ? t.line : 1);
  };

  Parser.prototype.eatExprUntil = function (type) {
    var depth = 0;
    while (true) {
      var t = this.peek();
      if (!t) this.err("代码结束（括号未闭合）", 1);
      if (t.t === "lparen" || t.t === "lbrack") depth++;
      else if (t.t === "rparen" || t.t === "rbrack") {
        if (depth === 0 && t.t === type) return;
        depth--;
      }
      this.eat();
    }
  };

  Parser.prototype.parseBlock = function () {
    var t = this.peek();
    if (t.t !== "lbrace") this.err("期望 '{' 开始函数体", t ? t.line : 1);
    this.eat();
    var body = [];
    while (true) {
      var nt = this.peek();
      if (!nt) this.err("函数体未闭合（缺少 '}'）", t.line);
      if (nt.t === "rbrace") { this.eat(); break; }
      body.push(this.parseStmt());
    }
    return { t: "block", line: t.line, body: body };
  };

  Parser.prototype.parseStmt = function () {
    var t = this.peek();
    if (!t) this.err("代码结束（语句未闭合）", 1);
    if (t.t === "semi") { this.eat(); return { t: "empty", line: t.line }; }
    if (t.t === "lbrace") return this.parseBlock();
    if (t.t === "id") {
      if (t.v in this.typedefs) return this.parseDecl(); /* typedef 别名开头的声明：ListNode* node = malloc(...); */
      switch (t.v) {
        case "if":
          this.eat();
          this.expectOp("(");
          var cond = this.parseExpr();
          this.expectOp(")");
          var thenS = this.parseStmt();
          var els = null;
          if (this.peek() && this.peek().t === "id" && this.peek().v === "else") {
            this.eat();
            els = this.parseStmt();
          }
          return { t: "if", cond: cond, then: thenS, els: els, line: t.line };
        case "while":
          this.eat();
          this.expectOp("(");
          var wcond = this.parseExpr();
          this.expectOp(")");
          return { t: "while", cond: wcond, body: this.parseStmt(), line: t.line };
        case "do":
          this.eat();
          var body = this.parseStmt();
          var wt = this.peek();
          if (!(wt && wt.t === "id" && wt.v === "while")) this.err("do 后缺少 while", wt ? wt.line : 1);
          this.eat();
          this.expectOp("(");
          var dcond = this.parseExpr();
          this.expectOp(")");
          var st2 = this.peek();
          if (st2.t === "semi") this.eat();
          return { t: "do", cond: dcond, body: body, line: t.line };
        case "for":
          this.eat();
          this.expectOp("(");
          var init = null, fcond = null, incr = null;
          if (this.peek().t !== "semi") init = this.parseStmt();
          else this.eat();
          if (this.peek().t === "semi") { this.eat(); fcond = null; }
          else { fcond = this.parseExpr(); this.expectOp(";"); }
          if (this.peek().t !== "rparen") incr = this.parseExpr();
          this.expectOp(")");
          return { t: "for", init: init, cond: fcond, incr: incr, body: this.parseStmt(), line: t.line };
        case "return":
          this.eat();
          var rexpr = null;
          if (this.peek().t !== "semi") rexpr = this.parseExpr();
          var rt = this.peek();
          if (rt.t === "semi") this.eat(); else this.err("return 后缺少 ';'", rt ? rt.line : 1);
          return { t: "return", expr: rexpr, line: t.line };
        case "break":
        case "continue":
          this.eat();
          var bt = this.peek();
          if (bt.t === "semi") this.eat(); else this.err(t.v + " 后缺少 ';'", bt ? bt.line : 1);
          return { t: t.v, line: t.line };
        case "int":
        case "const":
        case "void":
        case "char":
        case "struct":
          return this.parseDecl();
      }
    }
    /* 表达式语句 */
    var expr = this.parseExpr();
    var sem = this.peek();
    if (sem.t === "semi") this.eat(); else this.err("语句后缺少 ';'", sem ? sem.line : 1);
    return { t: "expr", expr: expr, line: t.line };
  };

  Parser.prototype.parseDecl = function () {
    var typeTok = this.peek();
    var type = this.parseType();
    var list = [this.parseDeclOne(type, typeTok.line)];
    /* 支持一条语句声明多个变量：int i = 0, j = 1; */
    while (this.peek().t === "comma") {
      this.eat();
      list.push(this.parseDeclOne(type, typeTok.line));
    }
    var sem = this.peek();
    if (sem.t === "semi") this.eat(); else this.err("声明后缺少 ';'", sem ? sem.line : 1);
    return list.length === 1 ? list[0] : { t: "decls", decls: list, line: typeTok.line };
  };

  Parser.prototype.parseDeclOne = function (type, line) {
    var nameTok = this.eat();
    if (!nameTok || nameTok.t !== "id") this.err("期望变量名，实际是 " + this.desc(nameTok), nameTok ? nameTok.line : 1);
    var t = this.peek();
    if (t.t === "lbrack" && type.kind === "struct" && type.ptr > 0) {
      /* 指针数组（图邻接表）：GNode* adj[5]; */
      this.hasPtrArray = true;
      this.eat();
      var psize = null;
      var pn = this.peek();
      if (pn.t === "num" && this.toks[this.p + 1] && this.toks[this.p + 1].t === "rbrack") {
        psize = this.parseExpr();
      } else if (pn.t === "id") {
        psize = { t: "var", name: pn.v, line: pn.line };
        this.eat();
      } else {
        this.err("指针数组大小暂只支持数字或单变量（如 GNode* adj[5]）", pn.line);
      }
      this.expectRBrack();
      var pat = this.peek();
      if (pat.t === "op" && pat.v === "=") {
        this.err("指针数组暂不支持初始化，请逐项赋值（如 adj[0] = createNode(...)）", pat.line);
      }
      return { t: "decl", name: nameTok.v, isArray: true, isPtrArray: true, type: type, sizeExpr: psize, init: null, line: line };
    }
    if (type.ptr > 0) {
      /* 指针变量：struct Node *p; 或 int *p; */
      var pinit = null;
      if (this.peek().t === "op" && this.peek().v === "=") {
        this.eat();
        pinit = this.parseExpr();
      }
      return { t: "decl", name: nameTok.v, isArray: false, isPtr: true, type: type, init: pinit, line: line };
    }
    if (type.kind === "struct") {
      /* 结构体值变量：Queue q;（不是指针） */
      var eq = this.peek();
      if (eq.t === "op" && eq.v === "=") {
        this.err("结构体变量暂不支持初始化（如 Queue q = {...}），请先声明后逐字段赋值", eq.line);
      }
      return { t: "decl", name: nameTok.v, isArray: false, isStruct: true, type: type, init: null, line: line };
    }
    if (t.t === "lbrack") {
      /* 数组声明 */
      this.eat();
      var sizeExpr = null;
      var np = this.peek();
      if (np.t === "rbrack") {
        /* int a[] = {...} */
      } else if (np.t === "num" && this.toks[this.p + 1] && this.toks[this.p + 1].t === "rbrack") {
        sizeExpr = this.parseExpr();
      } else if (np.t === "id") {
        sizeExpr = { t: "var", name: np.v, line: np.line };
        this.eat();
      } else {
        this.err("数组大小暂只支持数字或单变量（如 int a[10] 或 int tmp[n]）", np.line);
      }
      this.expectRBrack();
      var init = null;
      var at = this.peek();
      if (at.t === "op" && at.v === "=") {
        this.eat();
        if (this.peek().t !== "lbrace") this.err("数组初始化必须使用 { ... }", this.peek() ? this.peek().line : 1);
        this.eat();
        init = [];
        while (true) {
          if (this.peek().t === "rbrace") { this.eat(); break; }
          init.push(this.parseExpr());
          if (this.peek().t === "comma") this.eat();
          else if (this.peek().t === "rbrace") { this.eat(); break; }
          else this.err("数组初值需要逗号或 '}'", this.peek() ? this.peek().line : 1);
        }
      }
      return { t: "decl", name: nameTok.v, isArray: true, sizeExpr: sizeExpr, init: init, line: line };
    }
    if (t.t === "op" && t.v === "*") this.err("暂不支持指针变量，请直接使用数组 int a[N]", t.line);
    var initE = null;
    var eq = this.peek();
    if (eq.t === "op" && eq.v === "=") {
      this.eat();
      initE = this.parseExpr();
    }
    return { t: "decl", name: nameTok.v, isArray: false, init: initE, line: line };
  };

  /* 递归收集函数体内的数组声明 */
  function collectArrayDecls(stmt, out) {
    if (!stmt) return;
    if (stmt.t === "block") { stmt.body.forEach(function (s) { collectArrayDecls(s, out); }); return; }
    if (stmt.t === "decls") { stmt.decls.forEach(function (d) { collectArrayDecls(d, out); }); return; }
    if (stmt.t === "if") { collectArrayDecls(stmt.then, out); collectArrayDecls(stmt.els, out); return; }
    if (stmt.t === "while" || stmt.t === "do") { collectArrayDecls(stmt.body, out); return; }
    if (stmt.t === "for") { collectArrayDecls(stmt.init, out); collectArrayDecls(stmt.body, out); return; }
    if (stmt.t === "decl" && stmt.isArray) out.push(stmt);
  }

  /* ---- 表达式（优先级爬升） ---- */
  var BIN_LEVELS = [
    ["||"],
    ["&&"],
    ["|"],
    ["^"],
    ["&"],
    ["==", "!="],
    ["<", "<=", ">", ">="],
    ["<<", ">>"],
    ["+", "-"],
    ["*", "/", "%"],
  ];

  Parser.prototype.parseExpr = function () {
    return this.parseAssign();
  };

  Parser.prototype.parseAssign = function () {
    var left = this.parseTernary();
    var t = this.peek();
    if (t && t.t === "op" && (t.v === "=" || /^([+\-*/%&|^]|<<|>>)=$/.test(t.v))) {
      var op = t.v;
      if (op === "=") op = null;
      this.eat();
      var value = this.parseAssign();
      return { t: "assign", target: left, op: op, value: value, line: t.line };
    }
    return left;
  };

  Parser.prototype.parseTernary = function () {
    var cond = this.parseBinary(0);
    var t = this.peek();
    if (t && t.t === "op" && t.v === "?") {
      this.eat();
      var alt = this.parseAssign();
      this.expectOp(":");
      var fbk = this.parseTernary();
      return { t: "ternary", cond: cond, alt: alt, fbk: fbk, line: t.line };
    }
    return cond;
  };

  Parser.prototype.parseBinary = function (level) {
    if (level >= BIN_LEVELS.length) return this.parseUnary();
    var ops = BIN_LEVELS[level];
    var left = this.parseBinary(level + 1);
    while (true) {
      var t = this.peek();
      if (t && t.t === "op" && ops.indexOf(t.v) >= 0) {
        this.eat();
        var right = this.parseBinary(level + 1);
        left = { t: "binary", op: t.v, l: left, r: right, line: t.line };
      } else return left;
    }
  };

  Parser.prototype.parseUnary = function () {
    var t = this.peek();
    if (t && t.t === "op") {
      if (t.v === "*") {
        /* 解引用：仅用于解析 swap 函数体（swap 整体按内建语义执行，不运行函数体） */
        this.eat();
        return { t: "unary", op: "*", operand: this.parseUnary(), line: t.line };
      }
      if (t.v === "!" || t.v === "-" || t.v === "+" || t.v === "~") {
        this.eat();
        return { t: "unary", op: t.v, operand: this.parseUnary(), line: t.line };
      }
      if (t.v === "&") {
        this.eat();
        var inner = this.parseUnary();
        if (inner.t !== "index" && inner.t !== "var") {
          this.err("& 仅支持取数组元素地址（&a[i]）或变量地址（&head）", t.line);
        }
        return { t: "unary", op: "&", operand: inner, line: t.line };
      }
      if (t.v === "++" || t.v === "--") {
        this.eat();
        return { t: "unary", op: t.v, operand: this.parseUnary(), line: t.line, prefix: true };
      }
    }
    var e = this.parsePostfix();
    var nt = this.peek();
    while (nt && nt.t === "op" && (nt.v === "++" || nt.v === "--")) {
      this.eat();
      e = { t: "unary", op: nt.v, operand: e, line: nt.line, prefix: false };
      nt = this.peek();
    }
    return e;
  };

  Parser.prototype.parsePostfix = function () {
    var e = this.parsePrimary();
    while (true) {
      var t = this.peek();
      if (t && t.t === "lbrack") {
        this.eat();
        var idx = this.parseExpr();
        this.expectRBrack();
        if (e.t !== "var" && e.t !== "member") this.err("只有数组名支持下标，如 a[i]", t.line);
        e = { t: "index", name: e.t === "var" ? e.name : null, obj: e.t === "member" ? e : null, idx: idx, line: t.line };
      } else if (t && t.t === "op" && t.v === "->") {
        this.eat();
        var ft = this.eat();
        if (!ft || ft.t !== "id") this.err("-> 后需要字段名（如 p->data）", ft ? ft.line : 1);
        e = { t: "member", obj: e, field: ft.v, line: t.line };
      } else if (t && t.t === "op" && t.v === ".") {
        /* 结构体值成员访问：Queue q; q.front 取结构体变量字段 */
        this.eat();
        var ft2 = this.eat();
        if (!ft2 || ft2.t !== "id") this.err(". 后需要字段名（如 q.front）", ft2 ? ft2.line : 1);
        e = { t: "member", obj: e, field: ft2.v, line: t.line, dot: true };
      } else if (t && t.t === "lparen") {
        if (e.t !== "var") this.err("只有函数名可以调用", t.line);
        this.eat();
        var args = [];
        while (true) {
          if (this.peek().t === "rparen") { this.eat(); break; }
          args.push(this.parseExpr());
          if (this.peek().t === "comma") this.eat();
          else if (this.peek().t === "rparen") { this.eat(); break; }
          else this.err("函数参数需要逗号或 ')'", this.peek() ? this.peek().line : 1);
        }
        e = { t: "call", name: e.name, args: args, line: t.line };
      } else return e;
    }
  };

  Parser.prototype.parsePrimary = function () {
    var t = this.peek();
    if (!t) this.err("代码结束（表达式未完成）", 1);
    if (t.t === "num") { this.eat(); return { t: "num", v: t.v, line: t.line }; }
    if (t.t === "id") {
      if (t.v === "NULL" || t.v === "null") { this.eat(); return { t: "null", line: t.line }; }
      if (t.v === "INT_MIN") { this.eat(); return { t: "num", v: "-2147483648", line: t.line }; }
      if (t.v === "INT_MAX") { this.eat(); return { t: "num", v: "2147483647", line: t.line }; }
      if (t.v === "sizeof") {
        this.eat();
        this.expectOp("(");
        var nt2 = this.peek();
        if (nt2 && nt2.t === "id" && (nt2.v === "struct" || nt2.v === "int" || nt2.v === "char" ||
            nt2.v === "void" || nt2.v in this.typedefs)) {
          var st = this.parseType();
          if (st.kind === "struct") {
            this.expectOp(")");
            return { t: "sizeof", stype: st.structName, line: t.line };
          }
          this.expectOp(")");
          return { t: "sizeofNum", line: t.line }; /* sizeof(int) → 1 */
        }
        /* sizeof(表达式)：数组名返回长度，其余返回 1（sizeof(arr)/sizeof(arr[0]) 惯用法） */
        var se = this.parseExpr();
        this.expectOp(")");
        if (se.t === "var") return { t: "sizeofArr", name: se.name, line: t.line };
        return { t: "sizeofExpr", line: t.line };
      }
      this.eat();
      return { t: "var", name: t.v, line: t.line };
    }
    if (t.t === "lparen") {
      /* 强制类型转换：(struct Node *)expr / (ListNode *)expr */
      var nxt = this.toks[this.p + 1];
      if (nxt && nxt.t === "id" && (nxt.v === "struct" || nxt.v === "int" || nxt.v === "char" ||
          nxt.v === "void" || nxt.v in this.typedefs)) {
        this.eat();
        this.parseType();
        this.expectOp(")");
        return this.parseUnary();
      }
      this.eat();
      var e = this.parseExpr();
      this.expectOp(")");
      return e;
    }
    if (t.t === "str") { this.eat(); return { t: "str", line: t.line }; } /* 字符串仅用于 printf/puts（输出自动跳过） */
    this.err("期望表达式，实际是 " + this.desc(t), t.line);
  };

  /* ---------------- 解释执行 ---------------- */

  var MAX_STEPS = 4000;
  var MAX_DEPTH = 128;

  function Exec(prog, opts) {
    this.prog = prog;
    this.opts = opts || {};
    this.optSize = Math.min(Math.max(this.opts.size || 8, 4), 15);
    this.forceRandom = !!this.opts.forceRandom;
    this.scopeStack = [{}];
    this.scopeFuncs = [null];
    this.steps = [];
    this.main = null;
    this.recentWrites = [];
    this.readIdxs = [];
    this.touchedArray = false;
    this.stepPushedThisStmt = false;
    this.stats = { steps: 0, swaps: 0 };
    this.depth = 0;
    /* 链表模式（代码含 struct 定义） */
    this.structs = prog.structs || {};
    this.mode = (function () {
      var k = 0;
      for (var key in this.structs) { k++; }
      if (k === 0) return "array";
      /* 指针数组（邻接表）→ 图模式 */
      if (prog.hasPtrArray) return "graph";
      /* 含 left/right 指针字段的结构体 → 树模式（二叉树的 left/right 分支） */
      for (var sk in this.structs) {
        var sd = this.structs[sk];
        var names = {};
        for (var fi = 0; fi < sd.fields.length; fi++) names[sd.fields[fi].name] = 1;
        if (names.left && names.right) return "tree";
      }
      return "list";
    }).call(this);
    this.mainGraph = null; /* 第一个指针数组（图邻接表） */
    this.prevParent = null; /* 并查集：上一步的 parent 数组，用于检测路径压缩 */
    this.nodeSeq = 0;
    this.touchedList = false;
    this.listCur = null;
    this.nodePos = {};
    this.lastMember = "";
    this.lastIsWrite = false;
    this.listReads = [];
  }

  Exec.prototype.curScope = function () {
    return this.scopeStack[this.scopeStack.length - 1];
  };

  Exec.prototype.lookup = function (name) {
    for (var i = this.scopeStack.length - 1; i >= 0; i--) {
      if (name in this.scopeStack[i]) return this.scopeStack[i][name];
    }
    return undefined;
  };

  Exec.prototype.setVar = function (name, obj, line) {
    this.curScope()[name] = obj;
  };

  Exec.prototype.getVar = function (name, line) {
    var o = this.lookup(name);
    if (o === undefined) throw new CSimError(line, "变量 " + name + " 未定义");
    return o;
  };

  Exec.prototype.getArray = function (name, line) {
    var o = this.getVar(name, line);
    if (!o.isArray) throw new CSimError(line, name + " 不是数组");
    return o;
  };

  Exec.prototype.randomArray = function (n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(1 + Math.floor(Math.random() * 99));
    return a;
  };

  Exec.prototype.pushStep = function (line, msg, extra) {
    if (this.stats.steps >= MAX_STEPS) {
      throw new CSimError(line > 0 ? line : 1, "模拟步数超过上限（" + MAX_STEPS + "），可能存在死循环");
    }
    this.stats.steps++;
    var st = { line: line, arr: this.main ? this.main.arr.slice() : null, msg: msg || "" };
    if (this.mode === "list") st.list = this.listSnapshot();
    else if (this.mode === "tree") st.tree = this.treeSnapshot();
    else if (this.mode === "graph") st.graph = this.graphSnapshot();
    else {
      st.vars = this.collectVars();
      /* 并查集模式：通过检测数组变化追踪路径压缩 */
      if (this.prevParent && st.arr) {
        st.uf = this.ufSnapshot(st.arr);
      } else if (st.arr) {
        this.prevParent = st.arr.slice();
      }
      /* DP模式：检测是否有dp数组 */
      var hasDp = (st.vars && st.vars.dp && Array.isArray(st.vars.dp)) ||
                  (this.main && this.main.name === "dp");
      if (hasDp) {
        st.dp = this.dpSnapshot();
      }
    }
    if (extra) {
      if (extra.cmp) st.cmp = extra.cmp;
      if (extra.swap === true) st.swap = true;
      if (extra.done) st.done = extra.done;
    }
    this.steps.push(st);
    return st;
  };

  /* 链表/树/图模式结束步骤 */
  Exec.prototype.finishStep = function () {
    if (this.mode === "tree") {
      var ts = this.treeSnapshot();
      var cnt = ts.nodes ? Object.keys(ts.nodes).length : 0;
      this.pushStep(-1, "模拟执行结束（执行 " + this.stats.steps + " 步；树现有 " + cnt + " 个节点）");
      return;
    }
    if (this.mode === "graph") {
      var gs = this.graphSnapshot();
      this.pushStep(-1, "模拟执行结束（执行 " + this.stats.steps + " 步；图有 " + gs.n + " 个顶点）");
      return;
    }
    if (this.mode === "list") {
      var snap = this.listSnapshot();
      var msg = "模拟执行结束（执行 " + this.stats.steps + " 步；链表现有 " + snap.ids.length + " 个节点）";
      this.pushStep(-1, msg);
      return;
    }
    /* 并查集模式 */
    if (this.main && this.main.arr && this.prevParent) {
      var ufParent = this.prevParent;
      var components = 0;
      for (var ui = 0; ui < ufParent.length; ui++) {
        if (ufParent[ui] === ui) components++;
      }
      this.pushStep(-1, "模拟执行结束（执行 " + this.stats.steps + " 步；并查集现有 " + components + " 个连通分量）");
      return;
    }
    var a = this.main ? this.main.arr : [];
    var sorted = a.length > 0 && a.every(function (v, i) { return i === 0 || a[i - 1] <= v; });
    var msg = sorted
      ? "排序完成：数组已有序（执行 " + this.stats.steps + " 步，交换 " + this.stats.swaps + " 次）"
      : "模拟执行结束（执行 " + this.stats.steps + " 步）";
    var extra = null;
    if (sorted) {
      var done = new Array(a.length);
      for (var i = 0; i < a.length; i++) done[i] = true;
      extra = { done: done };
    }
    this.pushStep(-1, msg, extra);
  };

  /* ---- 链表运行时 ---- */

  /* 指针变量槽位：{v, __slot:true, isPtr:true}；堆节点：{__node:true, _id, ...字段}；
     &var 引用：{__ref: 槽位对象}。层层解开得到最终值 */
  Exec.prototype.derefVal = function (v) {
    while (v && typeof v === "object") {
      if (v.__slot) v = v.v;
      else if (v.__ref) v = v.__ref.v;
      else break;
    }
    return v;
  };

  /* 解引用后若得到堆节点/结构体值则返回该对象（用于 p->data 与 q.front），并标记链表访问 */
  Exec.prototype.listAccess = function (v, field, line) {
    this.touchedList = true;
    var node = this.derefVal(v);
    if (node && (node.__node || node.__struct)) {
      if (node.__node) this.listCur = node._id;
      return node;
    }
    return null;
  };

  Exec.prototype.allocNode = function (stype, line) {
    var sd = this.structs[stype];
    if (!sd) throw new CSimError(line, "未定义的 struct " + stype);
    var node = { __node: true, _id: ++this.nodeSeq };
    for (var i = 0; i < sd.fields.length; i++) {
      var f = sd.fields[i];
      if (f.isArrayField) {
        node[f.name] = new Array(f.arrSize || 100);
        for (var ai = 0; ai < node[f.name].length; ai++) node[f.name][ai] = 0;
      } else {
        node[f.name] = f.type.kind === "struct" ? null : 0;
      }
    }
    this.touchedList = true;
    this.listCur = node._id;
    return node;
  };

  /* 主链表快照：根指针取最外层作用域里首个非空的指针变量（head/top 等），
     再从根沿 next 遍历；全部指针变量位置一并输出 */
  Exec.prototype.listSnapshot = function () {
    var ids = [], data = {}, ptrs = [];
    var usedNames = {};
    var curId = null;
    /* 游标高亮：优先"最近写入的节点"；否则跟随遍历类指针（curr/cur/head 等，
       最内层作用域最后匹配者胜出，如 printList 内部的 head、reverseList 的 curr） */
    var WANDER = ["curr", "cur", "node", "p", "tmp", "head", "top"];
    var chains = []; /* 候选链根：指针变量 + 结构体值变量的指针字段（如 Queue q 的 q.front） */
    for (var si = 0; si < this.scopeStack.length; si++) {
      var scope = this.scopeStack[si];
      for (var key in scope) {
        var slot = scope[key];
        if (!slot) continue;
        if (slot.isPtr) {
          var v = this.derefVal(slot.v);
          var id = (v && v.__node && !v.__freed) ? v._id : null;
          /* 不同作用域的同名指针（如 main 的 head 与 reverseList 的 head）重命名，
             避免渲染时标签覆盖 */
          var disp = key;
          if (usedNames[key] !== undefined) {
            var fn = this.scopeFuncs[si];
            disp = (fn ? fn + "." : "") + key;
            var base = disp, dup = 2;
            while (usedNames[disp] !== undefined) disp = base + "_" + (dup++);
          }
          usedNames[disp] = true;
          ptrs.push({ name: disp, id: id, struct: id === null && !!v && v.__struct ? true : undefined });
          if (id !== null) chains.push({ root: v, label: disp, si: si, isMember: false });
          if (!this.listCur && id !== null && WANDER.indexOf(key) >= 0) curId = id;
          continue;
        }
        /* 结构体值变量（如 Queue q）：把指针字段当候选链根（layer 遍历的队列链可见） */
        var sv = slot.v;
        if (sv && sv.__struct) {
          for (var fk in sv) {
            if (fk === "__struct") continue;
            var fv = this.derefVal(sv[fk]);
            if (fv && fv.__node && !fv.__freed) chains.push({ root: fv, label: key + "." + fk, si: si, isMember: true });
          }
        }
      }
    }
    /* 逐条候选链沿 next 收集，主链优先级：最长 > 作用域更外层 > 指针变量（非结构体成员）。
       建树过程中 root（外层）恒为主链，队列就绪后 q.front 链最长胜出 */
    var mainLink = null;
    var edges = {};
    var prevEdges = null; /* 双向链表：节点的 prev 字段指向（有 prev 字段时才收集） */
    for (var ci = 0; ci < chains.length; ci++) {
      var link = { ids: [], data: {}, edges: {}, src: chains[ci] };
      var curN = chains[ci].root;
      var g2 = 0;
      while (curN && curN.__node && !curN.__freed && g2 < 200) {
        var f = this.firstField(curN);
        var fval = f !== null ? curN[f] : undefined;
        link.ids.push(curN._id);
        if (typeof fval === "number") link.data[curN._id] = fval;
        else if (fval && fval.__node) link.data[curN._id] = "#" + fval._id;
        else link.data[curN._id] = "·";
        var nx = this.derefVal(curN.next);
        link.edges[curN._id] = (nx && nx.__node && !nx.__freed) ? nx._id : null;
        if (curN.prev !== undefined) {
          if (!prevEdges) prevEdges = {};
          var pv = this.derefVal(curN.prev);
          prevEdges[curN._id] = (pv && pv.__node && !pv.__freed) ? pv._id : null;
        }
        curN = nx;
        g2++;
      }
      /* 所有可见节点（含游离）的 next 指向都输出，供渲染端画真实边 */
      for (var ek in link.edges) edges[ek] = link.edges[ek];
      if (!link.ids.length) continue; /* 空链不作为主链 */
      var better = !mainLink;
      if (mainLink && !better) {
        var a = link, b = mainLink;
        if (a.ids.length !== b.ids.length) better = a.ids.length > b.ids.length;
        else if (a.src.si !== b.src.si) better = a.src.si < b.src.si;
        else if (a.src.isMember !== b.src.isMember) better = !a.src.isMember;
      }
      if (better) mainLink = link;
    }
    if (mainLink) {
      ids = mainLink.ids;
      /* edges 已合并所有可见节点的 next 指向（含游离），不覆盖 */
      /* 所有候选链节点的数据都输出（游离框也要显示内容，如树节点的 val） */
      data = {};
      for (var lk = 0; lk < chains.length; lk++) {
        var clink = { ids: [], data: {} };
        var cn = chains[lk].root;
        var g3 = 0;
        while (cn && cn.__node && !cn.__freed && g3 < 200) {
          var cf = this.firstField(cn);
          var cv = cf !== null ? cn[cf] : undefined;
          if (typeof cv === "number") clink.data[cn._id] = cv;
          else if (cv && cv.__node) clink.data[cn._id] = "#" + cv._id;
          else clink.data[cn._id] = "·";
          cn = this.derefVal(cn.next);
          g3++;
        }
        for (var dk in clink.data) if (data[dk] === undefined) data[dk] = clink.data[dk];
      }
      /* 记录主链节点位置（游离时画回原位） */
      for (var pi = 0; pi < ids.length; pi++) this.nodePos[ids[pi]] = pi;
    }
    /* 次链（side）：除主链外最优的非空链（长度优先 → 外层优先 → 指针变量优先）。
       遇主链节点即停（合并场景展示 l2 链尚未被吞并的剩余部分）；
       内层作用域的单节点链（建链临时节点）不显示，避免闪烁 */
    var sideLink = null;
    for (var sdc = 0; sdc < chains.length; sdc++) {
      var sdLink = { ids: [], data: {} };
      var sdN = chains[sdc].root;
      var sdg = 0;
      while (sdN && sdN.__node && !sdN.__freed && sdg < 200) {
        if (ids.length && ids.indexOf(sdN._id) >= 0) break; /* 已属主链：剩余部分不重复显示 */
        var sdf = this.firstField(sdN);
        var sdv = sdf !== null ? sdN[sdf] : undefined;
        sdLink.ids.push(sdN._id);
        if (typeof sdv === "number") sdLink.data[sdN._id] = sdv;
        else if (sdv && sdv.__node) sdLink.data[sdN._id] = "#" + sdv._id;
        else sdLink.data[sdN._id] = "·";
        sdN = this.derefVal(sdN.next);
        sdg++;
      }
      if (!sdLink.ids.length) continue;
      if (chains[sdc].si > 0 && sdLink.ids.length < 2) continue; /* 内层单节点链跳过 */
      var sdBetter = !sideLink;
      if (sideLink && !sdBetter) {
        if (sdLink.ids.length !== sideLink.ids.length) sdBetter = sdLink.ids.length > sideLink.ids.length;
        else if (chains[sdc].si !== sideLink.si) sdBetter = chains[sdc].si < sideLink.si;
        else if (chains[sdc].isMember !== sideLink.isMember) sdBetter = !chains[sdc].isMember;
      }
      if (sdBetter) {
        sideLink = sdLink;
        sideLink.si = chains[sdc].si;
        sideLink.label = chains[sdc].label || "";
      }
    }
    var side = null;
    if (sideLink && sideLink.ids.length) {
      side = { ids: sideLink.ids, data: sideLink.data, label: sideLink.label };
      /* 次链节点数据并入快照 data（渲染时统一取值） */
      for (var sdk in sideLink.data) if (data[sdk] === undefined) data[sdk] = sideLink.data[sdk];
    }
    /* 条件比较中读取的节点（紫色高亮） */
    var cmpIds = null;
    if (this.listReads.length >= 2 &&
        this.listReads[0].nodeId !== null && this.listReads[1].nodeId !== null) {
      cmpIds = [this.listReads[0].nodeId, this.listReads[1].nodeId];
    }
    /* 结构体数组栈（MinStack 等）：含 int 数组字段 + top 的节点
       （obj->data[i] 形式），渲染端按数组栈显示 */
    var minStack = null;
    for (var msi = 0; msi < this.scopeStack.length && !minStack; msi++) {
      var msc = this.scopeStack[msi];
      for (var msk in msc) {
        var msv = this.derefVal(msc[msk].v);
        if (!msv || !msv.__node || msv.__freed) continue;
        var arrF = null, topF = null;
        for (var mfk in msv) {
          if (Array.isArray(msv[mfk])) {
            if (mfk === "data") arrF = mfk;
            else if (arrF === null) arrF = mfk;
          } else if (mfk === "top" || mfk === "size") topF = mfk;
        }
        if (arrF && topF !== null) {
          minStack = { data: msv[arrF], top: msv[topF] };
          break;
        }
      }
    }
    return {
      ids: ids, data: data, ptrs: ptrs, nodePos: this.nodePos, edges: edges,
      prevEdges: prevEdges,
      side: side, cmpIds: cmpIds, minStack: minStack,
      markNode: this.lastIsWrite ? this.lastMemberNode : null,
      markField: this.lastIsWrite ? this.lastMember : null,
      cur: this.listCur || curId || (ids.length ? ids[0] : null),
    };
  };

  /* 树快照：从根指针 BFS 收集 left/right 二叉树结构。
     输出 { nodes: {id → {data, left, right}}, rootId, cur, markNode, markField, cmpIds } */
  Exec.prototype.treeSnapshot = function () {
    var usedNames = {};
    var rootNode = null;
    var curId = null;
    var WANDER = ["curr", "cur", "node", "p", "tmp", "head", "top", "root"];
    for (var si = 0; si < this.scopeStack.length; si++) {
      var scope = this.scopeStack[si];
      for (var key in scope) {
        var slot = scope[key];
        if (!slot || !slot.isPtr) continue;
        var v = this.derefVal(slot.v);
        var id = (v && v.__node && !v.__freed) ? v._id : null;
        if (id === null) continue;
        if (rootNode === null) rootNode = v;
        if (!this.listCur && WANDER.indexOf(key) >= 0) curId = id;
      }
    }
    var nodes = {};
    if (rootNode) {
      var q = [rootNode];
      var visited = {};
      while (q.length) {
        var n = q.shift();
        if (!n || !n.__node || n.__freed || visited[n._id]) continue;
        visited[n._id] = 1;
        var f = this.firstField(n);
        nodes[n._id] = {
          data: f !== null && typeof n[f] === "number" ? n[f] : "·",
          left: n.left && n.left.__node && !n.left.__freed ? n.left._id : null,
          right: n.right && n.right.__node && !n.right.__freed ? n.right._id : null,
        };
        /* 红黑树：捕获 color 字段 */
        if (n.color !== undefined && n.color !== null) {
          nodes[n._id].color = n.color;
        }
        if (n.left && n.left.__node) q.push(n.left);
        if (n.right && n.right.__node) q.push(n.right);
      }
    }
    var cmpIds = null;
    if (this.listReads.length >= 2 &&
        this.listReads[0].nodeId !== null && this.listReads[1].nodeId !== null) {
      cmpIds = [this.listReads[0].nodeId, this.listReads[1].nodeId];
    }
    return {
      nodes: nodes,
      rootId: rootNode && !rootNode.__freed ? rootNode._id : null,
      cur: this.listCur || curId || (rootNode ? rootNode._id : null),
      markNode: this.lastIsWrite ? this.lastMemberNode : null,
      markField: this.lastIsWrite ? this.lastMember : null,
      cmpIds: cmpIds,
    };
  };

  /* 图快照（邻接表）：mainGraph 每个顶点的边链表 + 相关 int 数组/变量。
     输出 { adj: {顶点号 → [邻接节点id]}, data, n, vars, cur } */
  Exec.prototype.graphSnapshot = function () {
    var adj = {}, data = {};
    var arr = this.mainGraph ? this.mainGraph.arr : null;
    var n = arr ? arr.length : 0;
    for (var i = 0; i < n; i++) {
      var list = [];
      var p = arr[i];
      var g = 0;
      while (p && p.__node && !p.__freed && g < 200) {
        if (list.indexOf(p._id) >= 0) break; /* 防环 */
        list.push(p._id);
        var f = this.firstField(p);
        data[p._id] = f !== null && typeof p[f] === "number" ? p[f] : "·";
        p = this.derefVal(p.next);
        g++;
      }
      adj[i] = list;
    }
    /* 相关状态：visited 等 int 数组与 top/front 等 int 变量 */
    var vars = {};
    for (var si = 0; si < this.scopeStack.length; si++) {
      var scope = this.scopeStack[si];
      for (var key in scope) {
        var slot = scope[key];
        if (!slot || slot.isPtrArray) continue;
        if (slot.isArray && !slot.isPtrArray) {
          vars[key] = slot.arr.slice();
        } else if (!slot.isPtr && typeof slot.v === "number") {
          vars[key] = slot.v;
        }
      }
    }
    return {
      adj: adj, data: data, n: n, vars: vars,
      markNode: this.lastIsWrite ? this.lastMemberNode : null,
      markField: this.lastIsWrite ? this.lastMember : null,
      msgTail: this.lastMember || "",
    };
  };

  /* 数组模式快照的标量变量（top/front/rear 等，供栈/队列渲染）
     与辅助 int 数组（如分块查找的索引表 block[]） */
  Exec.prototype.collectVars = function () {
    var out = {};
    for (var si = 0; si < this.scopeStack.length; si++) {
      var scope = this.scopeStack[si];
      for (var key in scope) {
        var slot = scope[key];
        if (!slot || slot.isPtr) continue;
        if (slot.isArray) {
          if (slot !== this.main && !slot.isPtrArray) out[key] = slot.arr.slice();
          continue;
        }
        if (typeof slot.v === "number") out[key] = slot.v;
      }
    }
    return out;
  };

  /* 并查集快照：检测路径压缩（parent 数组变化） */
  Exec.prototype.ufSnapshot = function (parent) {
    var compressed = [];
    if (this.prevParent) {
      for (var i = 0; i < parent.length; i++) {
        if (this.prevParent[i] !== parent[i]) {
          compressed.push(i);
        }
      }
    }
    this.prevParent = parent.slice();
    return { parent: parent.slice(), compressed: compressed };
  };

  /* DP快照：收集dp数组及相关变量 */
  Exec.prototype.dpSnapshot = function () {
    var out = {};
    for (var si = 0; si < this.scopeStack.length; si++) {
      var scope = this.scopeStack[si];
      for (var key in scope) {
        var slot = scope[key];
        if (!slot || slot.isPtr) continue;
        if (slot.isArray) {
          if (slot !== this.main && !slot.isPtrArray) out[key] = slot.arr.slice();
          continue;
        }
        if (typeof slot.v === "number") out[key] = slot.v;
      }
    }
    /* this.main 是第一个声明的数组（DP 中为 w[]），collectVars 不会收集它，需单独处理 */
    var mainArr = (this.main && this.main.arr) ? this.main.arr.slice() : [];
    /* 若第一个声明的数组本身就叫 dp（如爬楼梯 int dp[11]），它被排除在 collectVars 之外，
       需把它作为 dp 表收集，否则该场景没有 dp 快照 */
    if (this.main && this.main.name === "dp" && out.dp === undefined) {
      out.dp = mainArr;
    }
    var phase = out.phase !== undefined ? out.phase : 0;
    var prevW = out.prev_w !== undefined ? out.prev_w : -1;
    /* 已处理物品：phase=2 时，i 之前的物品已处理完 */
    var processed = [];
    if (phase === 2 && out.i !== undefined) {
      for (var pi = 0; pi < out.i; pi++) processed.push(pi);
    }
    return {
      table: out.dp || [],
      weights: mainArr.length ? mainArr : (out.w || out.weight || []),
      values: out.v || out.value || [],
      n: out.n !== undefined ? out.n : 0,
      W: out.W !== undefined ? out.W : 0,
      phase: phase,
      i: out.i,
      j: out.j,
      prevW: prevW,
      processed: processed,
    };
  };

  /* 链表节点的显示字段：第一个 int 字段（通常是 data）；没有则取第一个指针字段
     （如 QueueNode 的 treeNode → 显示 "#<指向的节点>"） */
  Exec.prototype.firstField = function (node) {
    for (var key in node) {
      if (key === "_id" || key === "__node" || key === "__freed" || key === "next") continue;
      if (typeof node[key] === "number") return key;
    }
    for (var k2 in node) {
      if (k2 === "_id" || k2 === "__node" || k2 === "__freed" || k2 === "next") continue;
      if (node[k2] && node[k2].__node) return k2;
    }
    return null;
  };

  Exec.prototype.stepListLine = function (line, msg) {
    this.touchedList = true;
    this.pushStep(line, msg);
    this.stepPushedThisStmt = true;
  };

  /* 交换检测：最近 2..4 条"主数组写入"前后值恰好互换 → 判定为一个交换 */
  Exec.prototype.detectSwap = function () {
    var w = this.recentWrites;
    for (var k = Math.min(4, w.length); k >= 2; k--) {
      var win = w.slice(w.length - k);
      var idxs = [];
      for (var x = 0; x < win.length; x++) {
        if (idxs.indexOf(win[x].idx) < 0) idxs.push(win[x].idx);
      }
      if (idxs.length !== 2) continue;
      var i = idxs[0], j = idxs[1];
      var oldA = win[0].oldArr;
      var newA = this.main.arr;
      if (oldA[i] === newA[j] && oldA[j] === newA[i]) {
        for (var x2 = 0; x2 < win.length; x2++) {
          var st = this.steps[win[x2].stepIdx];
          if (st) st.swap = true;
        }
        this.stats.swaps++;
        var last = win[win.length - 1];
        var cur = this.steps[last.stepIdx];
        if (cur) cur.msg = "交换 a[" + i + "] 与 a[" + j + "]：" + oldA[i] + " 与 " + oldA[j] + " 互换";
        this.recentWrites = [];
        return true;
      }
    }
    return false;
  };

  Exec.prototype.writeIndex = function (arrObj, idx, val, line, msg) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= arrObj.arr.length) {
      throw new CSimError(line, "数组下标越界：a[" + idx + "]（数组长度 " + arrObj.arr.length + "）");
    }
    if (arrObj.isPtrArray) this.touchedList = true; /* 邻接表写入（adj[i] = node）走链表消息 */
    else this.touchedArray = true;
    var isMain = arrObj === this.main;
    var oldArr = isMain ? arrObj.arr.slice() : null;
    arrObj.arr[idx] = val;
    this.pushStep(line, msg || (arrObj.name + "[" + idx + "] = " + this.displayVal(val)));
    this.stepPushedThisStmt = true;
    if (isMain) {
      this.recentWrites.push({ idx: idx, oldArr: oldArr, newV: val, stepIdx: this.steps.length - 1 });
      this.detectSwap();
    }
  };

  Exec.prototype.readIndex = function (arrObj, idx, line) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= arrObj.arr.length) {
      throw new CSimError(line, "数组下标越界：a[" + idx + "]（数组长度 " + arrObj.arr.length + "）");
    }
    if (!arrObj.isPtrArray) this.touchedArray = true; /* 邻接表读取不产生数组消息 */
    if (arrObj === this.main && this.readIdxs.indexOf(idx) < 0) this.readIdxs.push(idx);
    return arrObj.arr[idx];
  };

  Exec.prototype.evalIndex = function (idxExpr, line) {
    var v = this.evalExpr(idxExpr);
    if (!Number.isInteger(v)) {
      throw new CSimError(line, "数组下标必须是整数，实际是 " + v);
    }
    return v;
  };

  Exec.prototype.evalExpr = function (e) {
    switch (e.t) {
      case "num":
        return Number(e.v);
      case "str":
        return 0; /* 字符串仅在 printf/puts 中出现（参数不评估），此处兜底 */
      case "var": {
        var o = this.getVar(e.name, e.line);
        if (o.isArray) throw new CSimError(e.line, e.name + " 是数组，不能直接当数值使用");
        return o.v;
      }
      case "index": {
        var idxArr = e.obj
          ? { arr: this.evalExpr(e.obj), name: this.memberName(e.obj) || "结构体" }
          : this.getArray(e.name, e.line);
        return this.readIndex(idxArr, this.evalIndex(e.idx, e.line), e.line);
      }
      case "member":
        return this.readMember(e, e.line);
      case "null":
        return null;
      case "sizeof":
        return { __stype: e.stype };
      case "sizeofArr":
        this.touchedArray = true;
        return this.getArray(e.name, e.line).arr.length;
      case "sizeofNum":
      case "sizeofExpr":
        return 1;
      case "assign":
        return this.evalAssign(e);
      case "binary": {
        if (e.op === "&&") {
          var l1 = this.evalExpr(e.l);
          return l1 ? (this.evalExpr(e.r) ? 1 : 0) : 0;
        }
        if (e.op === "||") {
          var l2 = this.evalExpr(e.l);
          return l2 ? 1 : (this.evalExpr(e.r) ? 1 : 0);
        }
        return this.binOp(e.op, this.evalExpr(e.l), this.evalExpr(e.r), e.line);
      }
      case "unary":
        return this.evalUnary(e);
      case "ternary":
        return this.evalExpr(e.cond) ? this.evalExpr(e.alt) : this.evalExpr(e.fbk);
      case "call":
        return this.evalCall(e);
      default:
        throw new CSimError(e.line, "未知的表达式节点");
    }
  };

  Exec.prototype.binOp = function (op, l, r, line) {
    switch (op) {
      case "+": return l + r;
      case "-": return l - r;
      case "*": return l * r;
      case "/":
        if (r === 0) throw new CSimError(line, "除数为 0");
        return Math.trunc(l / r); /* C 整数除法 */
      case "%":
        if (r === 0) throw new CSimError(line, "取模除数为 0");
        return ((l % r) + r) % r;
      case "<<": return (l << r) | 0;
      case ">>": return (l >> r) | 0;
      case "<": return l < r ? 1 : 0;
      case "<=": return l <= r ? 1 : 0;
      case ">": return l > r ? 1 : 0;
      case ">=": return l >= r ? 1 : 0;
      case "==": return l === r ? 1 : 0;
      case "!=": return l !== r ? 1 : 0;
      case "&": return (l & r) | 0;
      case "|": return (l | r) | 0;
      case "^": return (l ^ r) | 0;
      case "&&": return l && r ? 1 : 0;
      case "||": return l || r ? 1 : 0;
      default:
        throw new CSimError(line, "暂不支持的运算符 " + op);
    }
  };

  /* p->field 读取 */
  Exec.prototype.readMember = function (e, line) {
    var node = this.listAccess(this.evalExpr(e.obj), e.field, line);
    if (!node) throw new CSimError(line, "访问空指针：" + this.memberName(e) + "（p 为 NULL）");
    var rv = node[e.field];
    this.lastMember = this.memberName(e);
    this.lastIsWrite = false;
    this.listReads.push({ expr: this.memberName(e), val: rv, nodeId: node.__node ? node._id : null });
    return rv;
  };

  Exec.prototype.memberName = function (e) {
    if (e.t === "member") return this.memberName(e.obj) + (e.dot ? "." : "->") + e.field;
    if (e.t === "var") return e.name;
    if (e.t === "null") return "NULL";
    return "?";
  };

  /* 赋值目标为 p->field / q.field 时的写入 */
  Exec.prototype.writeMember = function (objExpr, field, val, line) {
    var node = this.listAccess(this.evalExpr(objExpr), field, line);
    var sep = objExpr && objExpr.dot ? "." : "->";
    if (!node) throw new CSimError(line, "访问空指针：" + this.memberName(objExpr) + sep + field + "（p 为 NULL）");
    node[field] = val;
    if (node.__node) {
      this.listCur = node._id;
      this.lastMemberNode = node._id;
    }
    this.lastMember = this.memberName(objExpr) + sep + field;
    this.lastIsWrite = true;
    this.lastWriteVal = this.displayVal(val);
    return val;
  };

  Exec.prototype.setIndex = function (arrObj, idx, val, line) {
    this.writeIndex(arrObj, idx, val, line, arrObj.name + "[" + idx + "] = " + this.displayVal(val));
  };

  Exec.prototype.evalAssign = function (e) {
    var v = this.evalExpr(e.value);
    var t = e.target;
    if (t.t === "var") {
      var o = this.getVar(t.name, e.line);
      if (o.isArray) throw new CSimError(e.line, "不能直接给数组 " + t.name + " 整体赋值");
      var newVV = v;
      if (v && v.__ref) newVV = v.__ref; /* head = *q；q 绑定的是槽 */
      if (e.op === null) {
        o.v = newVV;
      } else {
        o.v = this.binOp(e.op.slice(0, -1), o.v, v, e.line);
      }
      if (o.isPtr) {
        this.touchedList = true;
        if (!(this.lastMember && this.lastMember.indexOf("->") >= 0)) {
          this.lastMember = t.name;
          this.lastIsWrite = true;
          this.lastWriteVal = this.displayVal(o.v);
        }
      }
      return o.v;
    }
    if (t.t === "index") {
      var arr = t.obj
        ? { arr: this.evalExpr(t.obj), name: this.memberName(t.obj) || "结构体" }
        : this.getArray(t.name, e.line);
      var idx = this.evalIndex(t.idx, e.line);
      var newV = v;
      if (e.op !== null) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= arr.arr.length) {
          throw new CSimError(e.line, "数组下标越界：a[" + idx + "]（数组长度 " + arr.arr.length + "）");
        }
        newV = this.binOp(e.op.slice(0, -1), arr.arr[idx], v, e.line);
      }
      var arrName = t.obj ? (this.memberName(t.obj) || "结构体") : arr.name;
      this.writeIndex(arr, idx, newV, e.line, arrName + "[" + idx + "] = " + this.displayVal(newV));
      return newV;
    }
    if (t.t === "member") {
      var newM = v;
      if (e.op !== null) {
        newM = this.binOp(e.op.slice(0, -1), this.readMember(t, e.line), v, e.line);
      }
      this.writeMember(t.obj, t.field, newM, e.line);
      return newM;
    }
    if (t.t === "unary" && t.op === "*") {
      /* *p = v：p 指向槽位（&head）或堆节点字段由成员访问处理，此处仅支持解引用槽位 */
      var targ0 = t.operand;
      if (targ0.t === "var") {
        var to0 = this.lookup(targ0.name);
        if (to0 && to0.isArray) {
          throw new CSimError(e.line, "不支持指针解引用赋值（如 *p = 1），请改写为数组下标 a[i]");
        }
      }
      var ref = this.evalExpr(t.operand);
      var slot = ref && ref.__ref ? ref.__ref : (ref && ref.__slot ? ref : null);
      if (!slot) throw new CSimError(e.line, "解引用赋值 *p = v 仅支持 p 由 & 取址（如 *q = &head）");
      var newS = v;
      if (e.op !== null) newS = this.binOp(e.op.slice(0, -1), slot.v, v, e.line);
      slot.v = newS;
      return newS;
    }
    throw new CSimError(e.line, "非法的赋值目标");
  };

  Exec.prototype.evalUnary = function (e) {
    if (e.op === "*") {
      /* *p：p 为 &head 引用或指针变量 */
      var op0 = e.operand;
      if (op0.t === "var") {
        var ov0 = this.lookup(op0.name);
        if (ov0 && ov0.isArray) {
          throw new CSimError(e.line, "不支持指针解引用赋值（如 *p = 1），请改写为数组下标 a[i]");
        }
      }
      var ref = this.evalExpr(e.operand);
      var slot = ref && ref.__ref ? ref.__ref : (ref && ref.__slot ? ref : null);
      if (!slot) throw new CSimError(e.line, "指针解引用 *p 仅支持 p 指向变量地址（如 ** 参数传 &head）");
      var dv = this.derefVal(slot.v);
      if (dv && dv.__node) {
        this.touchedList = true;
        this.listCur = dv._id;
      }
      return slot.v;
    }
    if (e.op === "&") {
      var inner = e.operand;
      if (inner.t === "var") {
        return { __ref: this.getVar(inner.name, e.line) };
      }
      return { addr: true, name: inner.name, idx: this.evalIndex(inner.idx, e.line) };
    }
    if (e.op === "!" || e.op === "-" || e.op === "+" || e.op === "~") {
      var v = this.evalExpr(e.operand);
      if (e.op === "!") return v ? 0 : 1;
      if (e.op === "-") return -v;
      if (e.op === "+") return v;
      return ~v;
    }
    if (e.op === "++" || e.op === "--") {
      var target = e.operand;
      var old;
      if (target.t === "var") {
        old = this.getVar(target.name, e.line).v;
        this.getVar(target.name, e.line).v = e.op === "++" ? old + 1 : old - 1;
        return e.prefix ? old + (e.op === "++" ? 1 : -1) : old;
      }
      if (target.t === "member") {
        /* obj->top++：结构体整数字段自增 */
        var mnode = this.listAccess(this.evalExpr(target.obj), target.field, e.line);
        if (!mnode) throw new CSimError(e.line, "访问空指针：" + this.memberName(target) + "（p 为 NULL）");
        old = mnode[target.field];
        mnode[target.field] = e.op === "++" ? old + 1 : old - 1;
        this.listCur = mnode._id;
        this.lastMember = this.memberName(target);
        this.lastIsWrite = true;
        return e.prefix ? mnode[target.field] : old;
      }
      if (target.t === "index") {
        if (target.obj) {
          throw new CSimError(e.line, "++/-- 暂不支持结构体数组字段（如 obj->data[i]++）");
        }
        var arr = this.getArray(target.name, e.line);
        var idx = this.evalIndex(target.idx, e.line);
        if (!Number.isInteger(idx) || idx < 0 || idx >= arr.arr.length) {
          throw new CSimError(e.line, "数组下标越界：a[" + idx + "]（数组长度 " + arr.arr.length + "）");
        }
        old = arr.arr[idx];
        var nv = e.op === "++" ? old + 1 : old - 1;
        /* ++a[i] 也是数组写入，出一步 */
        var wasTouched = this.touchedArray;
        this.writeIndex(arr, idx, nv, e.line, "a[" + idx + "] = " + nv);
        this.stepPushedThisStmt = true;
        return e.prefix ? nv : old;
      }
      throw new CSimError(e.line, "++/-- 目标必须是变量或数组元素");
    }
    throw new CSimError(e.line, "未知的一元运算符 " + e.op);
  };

  /* 条件求值：同时生成比较步骤（cmp 标记数组下标对） */
  Exec.prototype.evalCond = function (cond, line, desc) {
    this.touchedArray = false;
    this.readIdxs = [];
    this.listReads = [];
    var v = !!this.evalExpr(cond);
    var extra = {};
    var msg = desc;
    if (this.listReads.length >= 2) {
      /* 链表比较（如 l1->val <= l2->val）：两个节点紫色高亮 + 值比较消息 */
      extra.cmpIds = [this.listReads[0].nodeId, this.listReads[1].nodeId];
      msg = "比较 " + this.listReads[0].expr + "=" + this.listReads[0].val +
        " 与 " + this.listReads[1].expr + "=" + this.listReads[1].val;
    } else if (this.listReads.length === 1) {
      extra.cmpIds = [this.listReads[0].nodeId, this.listReads[0].nodeId];
      msg = "判断 " + this.listReads[0].expr + "=" + this.listReads[0].val;
    } else if (this.readIdxs.length >= 2) {
      extra.cmp = [this.readIdxs[0], this.readIdxs[1]];
      msg = "比较 a[" + extra.cmp[0] + "]=" + this.main.arr[extra.cmp[0]] +
        " 与 a[" + extra.cmp[1] + "]=" + this.main.arr[extra.cmp[1]];
    } else if (this.readIdxs.length === 1) {
      extra.cmp = [this.readIdxs[0], this.readIdxs[0]];
      msg = "判断 a[" + this.readIdxs[0] + "]=" + this.main.arr[this.readIdxs[0]];
    }
    msg += v ? "：条件成立" : "：条件不成立";
    this.pushStep(line, msg, extra);
    this.stepPushedThisStmt = true;
    return v;
  };

  /* swap(&a[i], &a[j]) 特判：函数名为 swap 时按内建交换语义执行 */
  Exec.prototype.addrArg = function (expr, line) {
    if (expr.t === "unary" && expr.op === "&" && expr.operand.t === "index") {
      return { arr: this.getArray(expr.operand.name, line), idx: this.evalIndex(expr.operand.idx, line) };
    }
    if (expr.t === "index") {
      return { arr: this.getArray(expr.name, line), idx: this.evalIndex(expr.idx, line) };
    }
    throw new CSimError(line, "swap 参数必须是 &a[i] 或 a[i] 形式");
  };

  Exec.prototype.doSwapCall = function (e) {
    if (e.args.length !== 2) {
      throw new CSimError(e.line, "swap 需要两个参数：swap(&a[i], &a[j])");
    }
    var t0 = this.addrArg(e.args[0], e.line);
    var t1 = this.addrArg(e.args[1], e.line);
    if (t0.arr !== this.main || t1.arr !== this.main) {
      throw new CSimError(e.line, "swap 仅支持交换主数组元素");
    }
    var i = t0.idx, j = t1.idx;
    var a = this.main.arr;
    if (i === j) return a[i];
    var oldI = a[i], oldJ = a[j];
    a[i] = oldJ;
    a[j] = oldI;
    this.touchedArray = true;
    this.pushStep(e.line, "交换 a[" + i + "] 与 a[" + j + "]：" + oldI + " 与 " + oldJ + " 互换", { swap: true });
    this.stepPushedThisStmt = true;
    this.stats.swaps++;
    this.recentWrites = [];
    return oldI;
  };

  Exec.prototype.evalCall = function (e) {
    var name = e.name;
    if (name === "swap") return this.doSwapCall(e);
    if (name === "printf" || name === "puts") {
      return 0; /* 输出自动跳过：printList 等打印函数可保留，不参与动画 */
    }
    if (name === "scanf" || name === "gets") {
      throw new CSimError(e.line, "不支持 " + name + "（无法模拟键盘输入），请从代码中移除");
    }
    if (name === "malloc") {
      if (e.args.length !== 1) {
        throw new CSimError(e.line, "malloc 需要 1 个参数：malloc(sizeof(struct X))，如 p = malloc(sizeof(struct Node))");
      }
      var sv = this.evalExpr(e.args[0]);
      if (!sv || !sv.__stype) {
        throw new CSimError(e.line, "malloc 目前仅支持 sizeof(struct X) 作参数，如 p = malloc(sizeof(struct Node))");
      }
      var node = this.allocNode(sv.__stype, e.line);
      return node;
    }
    if (name === "free") {
      if (e.args.length !== 1) {
        throw new CSimError(e.line, "free 需要 1 个参数：free(p)");
      }
      var fv = this.evalExpr(e.args[0]);
      var fnode = this.derefVal(fv);
      if (fnode && fnode.__node && !fnode.__freed) {
        fnode.__freed = true;
        delete this.nodePos[fnode._id];
        this.touchedList = true;
        this.pushStep(e.line, "释放节点 #" + fnode._id + "（free）");
        this.stepPushedThisStmt = true;
      }
      return 0;
    }
    var fn = this.findFunc(name);
    if (!fn) throw new CSimError(e.line, "函数 " + name + " 未定义，或暂不支持该函数调用");
    if (e.args.length !== fn.params.length) {
      throw new CSimError(e.line, "函数 " + name + " 需要 " + fn.params.length + " 个参数，实际传入 " + e.args.length);
    }
    var args = [];
    for (var i = 0; i < e.args.length; i++) {
      var a = e.args[i];
      if (fn.params[i].isArray) {
        if (a.t === "var") {
          var o = this.lookup(a.name);
          if (o && o.isArray) { args.push(o); continue; }
        }
        throw new CSimError(e.line, "参数 " + (i + 1) + " 需要传数组名（如 " + name + "(" + fn.params[i].name + ", ...)）");
      }
      if (a.t === "var") {
        /* int* / struct* 参数传入数组名 → 仍按数组绑定 */
        var o1 = this.lookup(a.name);
        if (o1 && o1.isArray) { args.push(o1); continue; }
      }
      args.push(this.evalExpr(a));
    }
    this.touchedArray = true;
    var self = this;
    var st = this.pushStep(e.line, "调用函数 " + name + "(" + args.map(function (x) {
      return x && x.isArray ? "a[]" : self.displayVal(x);
    }).join(", ") + ")");
    this.stepPushedThisStmt = true;
    var ret = this.callFunction(fn, args, e.line);
    if (ret !== undefined) return ret; /* 有返回值（链表函数 createNode 等） */
    return st;
  };

  /* 值的中文显示（链表模式） */
  Exec.prototype.displayVal = function (v) {
    if (v && typeof v === "object") {
      if (v.__node) return "节点 #" + v._id;
      if (v.__struct) return "结构体变量";
      if (v.__ref) return "&" + (v.__ref.name || "变量");
      if (v.isArray) return "a[]";
    }
    if (v === null || v === undefined) return "NULL";
    return String(v);
  };

  Exec.prototype.findFunc = function (name) {
    for (var i = 0; i < this.prog.funcs.length; i++) {
      if (this.prog.funcs[i].name === name) return this.prog.funcs[i];
    }
    return null;
  };

  Exec.prototype.callFunction = function (fn, args, line, keepScope) {
    if (this.depth >= MAX_DEPTH) {
      throw new CSimError(line, "递归深度超过上限（" + MAX_DEPTH + "），请检查递归结束条件");
    }
    this.depth++;
    this.scopeStack.push({});
    this.scopeFuncs.push(fn.name);
    var s = this.curScope();
    for (var i = 0; i < fn.params.length; i++) {
      var a = args[i];
      var p = fn.params[i];
      if (a && a.isArray) {
        s[p.name] = a;
      } else if (p.isStructPtr || p.isPointer) {
        var slot = { v: a, __slot: true, isPtr: true, name: p.name };
        s[p.name] = slot;
      } else {
        s[p.name] = { v: a };
      }
    }
    try {
      this.execStmt(fn.body);
      return undefined;
    } catch (er) {
      if (er && "__ret" in er) return er.__ret;
      throw er;
    } finally {
      this.depth--;
      if (!keepScope) {
        this.scopeStack.pop();
        this.scopeFuncs.pop();
      }
    }
  };

  Exec.prototype.execStmt = function (st) {
    if (!st) return;
    this.touchedArray = false;
    this.touchedList = false;
    this.stepPushedThisStmt = false;
    this.readIdxs = [];
    this.listCur = null;
    this.lastMemberNode = null;
    this.lastWriteVal = null;
    this.lastIsWrite = false;
    this.lastMember = null;
    this.listReads = [];
    switch (st.t) {
      case "block":
        for (var i = 0; i < st.body.length; i++) this.execStmt(st.body[i]);
        return;
      case "empty":
        return;
      case "if": {
        var v = this.evalCond(st.cond, st.line, "判断条件");
        if (v) this.execStmt(st.then);
        else if (st.els) this.execStmt(st.els);
        return;
      }
      case "while": {
        while (true) {
          var cv = this.evalCond(st.cond, st.line, "循环条件");
          if (!cv) break;
          try {
            this.execStmt(st.body);
          } catch (er) {
            if (er && er.__break) break;
            if (er && er.__cont) continue;
            throw er;
          }
        }
        return;
      }
      case "do": {
        while (true) {
          try {
            this.execStmt(st.body);
          } catch (er) {
            if (er && er.__break) break;
            if (er && er.__cont) { /* 继续执行循环条件 */ }
            else throw er;
          }
          var dv = this.evalCond(st.cond, st.line, "循环条件");
          if (!dv) break;
        }
        return;
      }
      case "for": {
        if (st.init) this.execStmt(st.init);
        while (true) {
          if (st.cond) {
            var fv = this.evalCond(st.cond, st.line, "循环条件");
            if (!fv) break;
          }
          try {
            this.execStmt(st.body);
          } catch (er) {
            if (er && er.__break) break;
            if (er && er.__cont) { /* 执行增量表达式 */ }
            else throw er;
          }
          if (st.incr) this.execExprStmt(st.incr, st.line);
        }
        return;
      }
      case "return": {
        var rv = st.expr ? this.evalExpr(st.expr) : undefined;
        throw { __ret: rv };
      }
      case "break":
        throw { __break: true };
      case "continue":
        throw { __cont: true };
      case "decls":
        for (var di = 0; di < st.decls.length; di++) this.execDecl(st.decls[di]);
        return;
      case "decl":
        return this.execDecl(st);
      case "expr":
        return this.execExprStmt(st.expr, st.line);
      default:
        throw new CSimError(st.line, "未知的语句类型");
    }
  };

  /* for 的增量表达式：按"表达式语句"执行（可能产生数组写入步骤） */
  Exec.prototype.execExprStmt = function (expr, line) {
    this.touchedArray = false;
    this.touchedList = false;
    this.stepPushedThisStmt = false;
    this.readIdxs = [];
    this.evalExpr(expr);
    if (this.touchedList && !this.stepPushedThisStmt) {
      var lm = this.lastMember;
      var msg;
      if (this.lastIsWrite && lm) {
        if (this.lastMemberNode !== null && this.lastMemberNode !== undefined) {
          /* 成员写入：写入 curr->next：节点 #3 的 next 指向节点 #2 */
          var fld = lm;
          var fi = fld.lastIndexOf("->");
          var di = fld.lastIndexOf(".");
          var cut = Math.max(fi, di);
          if (cut >= 0) fld = fld.slice(cut + 2);
          msg = "写入 " + lm + "：节点 #" + this.lastMemberNode + " 的 " + fld
            + (this.lastWriteVal !== null && this.lastWriteVal !== undefined ? " 指向 " + this.lastWriteVal : "");
        } else if (this.lastWriteVal !== null && this.lastWriteVal !== undefined) {
          /* 指针变量赋值：curr → 节点 #4 */
          msg = lm + " → " + this.lastWriteVal;
        } else {
          msg = "写入 " + lm;
        }
      } else {
        msg = lm ? "读取 " + lm : "访问链表";
      }
      this.pushStep(line, msg);
      return;
    }
    if (this.touchedArray && !this.stepPushedThisStmt) {
      var idx = this.readIdxs.length ? this.readIdxs[this.readIdxs.length - 1] : -1;
      this.pushStep(line, idx >= 0 ? "读取 a[" + idx + "]" : "读取数组元素");
    }
  };

  Exec.prototype.execDecl = function (st) {
    if (st.isStruct) {
      /* 结构体值变量：Queue q; → 字段对象（非指针、不参与指针快照） */
      var sd = this.structs[st.type.structName];
      if (!sd) throw new CSimError(st.line, "未定义的 struct " + st.type.structName);
      var sobj = { __struct: true };
      for (var sfi = 0; sfi < sd.fields.length; sfi++) {
        var sfdef = sd.fields[sfi];
        sobj[sfdef.name] = sfdef.type.kind === "struct" ? null : 0;
      }
      this.setVar(st.name, { v: sobj, __slot: true }, st.line);
      this.touchedList = true;
      this.pushStep(st.line, "声明 " + st.type.structName + " 变量 " + st.name);
      this.stepPushedThisStmt = true;
      return;
    }
    if (st.isPtr) {
      /* 指针变量：struct Node *p = ...; 或 int *p = ...; */
      var pv = st.init ? this.evalExpr(st.init) : null;
      if (pv && pv.__ref) pv = pv.__ref; /* p = &head */
      var pslot = { v: pv, __slot: true, isPtr: true, name: st.name };
      this.setVar(st.name, pslot, st.line);
      if (pv) {
        this.touchedList = true;
        this.lastMember = st.name;
      }
      if (st.init && (this.touchedList || this.mode === "list")) {
        this.pushStep(st.line, st.name + " = " + this.displayVal(pslot.v));
        this.stepPushedThisStmt = true;
      }
      return;
    }
    if (!st.isArray) {
      if (st.init) {
this.touchedArray = false;
    this.touchedList = false;
    this.stepPushedThisStmt = false;
    this.readIdxs = [];
    this.listCur = null;
        var v = this.evalExpr(st.init);
        this.setVar(st.name, { v: v }, st.line);
        if (this.touchedList && !this.stepPushedThisStmt) {
          this.pushStep(st.line, st.name + " = " + this.displayVal(v));
        } else if (this.touchedArray && !this.stepPushedThisStmt) {
          this.pushStep(st.line, st.name + " = " + v);
        }
      } else {
        this.setVar(st.name, { v: 0 }, st.line);
      }
      return;
    }
    /* 数组声明 */
    if (st.isPtrArray) {
      /* 指针数组（图邻接表）：GNode* adj[N]; 元素初始为 NULL */
      var paLen = this.arraySizeOf(st, null);
      var paArr = [];
      for (var pai = 0; pai < paLen; pai++) paArr.push(null);
      var paObj = { isArray: true, isPtrArray: true, name: st.name, arr: paArr };
      this.setVar(st.name, paObj, st.line);
      if (!this.mainGraph) {
        this.mainGraph = paObj;
        this.touchedList = true;
        this.pushStep(st.line, "初始化图邻接表 " + st.name + "（" + paLen + " 个顶点）");
        this.stepPushedThisStmt = true;
      }
      return;
    }
    var initVals = null;
    if (st.init && st.init.length) {
      initVals = [];
      for (var i = 0; i < st.init.length; i++) initVals.push(this.evalExpr(st.init[i]));
    }
    if (!this.main) {
      /* 第一个数组声明即主数组（声明初值优先，其次外部初值，最后随机） */
      var srcVals = initVals;
      if (!srcVals && this.pendingIni && !this.forceRandom) {
        srcVals = [];
        for (var k2 = 0; k2 < this.pendingIni.length; k2++) srcVals.push(this.evalExpr(this.pendingIni[k2]));
      }
      if (srcVals && this.forceRandom) srcVals = null;
      var mainLen = srcVals ? srcVals.length : this.arraySizeOf(st, initVals);
      var mdata = srcVals ? srcVals.slice() : this.randomArray(mainLen);
      this.main = { isArray: true, name: st.name, arr: mdata };
      this.setVar(st.name, this.main, st.line);
      this.pushStep(st.line, "初始化数组 " + st.name + " = { " + mdata.join(", ") + " }");
      this.stepPushedThisStmt = true;
      return;
    }
    /* 局部数组（辅助数组，如归并的 tmp，不参与动画） */
    var len = initVals ? initVals.length : this.arraySizeOf(st, initVals);
    var data = initVals ? initVals.slice() : this.randomArray(len);
    this.setVar(st.name, { isArray: true, name: st.name, arr: data }, st.line);
  };

  /* 数组长度：初值长度 > 显式大小 > 默认大小 */
  Exec.prototype.arraySizeOf = function (st, initVals) {
    if (st.sizeExpr) {
      var sv = this.evalExpr(st.sizeExpr);
      if (!Number.isInteger(sv) || sv < 1) {
        throw new CSimError(st.line, "数组大小必须是正整数，实际是 " + sv);
      }
      if (sv > 100) throw new CSimError(st.line, "数组大小不能超过 100");
      return sv;
    }
    return this.optSize;
  };

  /* ---------------- 入口 ---------------- */

  /* 函数作为"算法入口"的适配度：真正的 [] 数组参数 3 分，体内数组声明 3 分，指针参数 1 分 */
  function arrScore(fn) {
    var s = fn.arrayDecls.length * 3;
    for (var pi = 0; pi < fn.params.length; pi++) {
      if (fn.params[pi].isArray) s += fn.params[pi].isPointer ? 1 : 3;
    }
    return s;
  }

  /* 在语句树里找到第一个"调用某个含数组函数"的调用节点（用于识别 main 里的算法调用） */
  function findEntryCall(stmt, funcs) {
    if (!stmt) return null;
    if (stmt.t === "expr" && stmt.expr && stmt.expr.t === "call") {
      for (var i = 0; i < funcs.length; i++) {
        if (funcs[i].name === stmt.expr.name && funcs[i].hasArray && funcs[i].name !== "main") {
          return stmt.expr;
        }
      }
      return null;
    }
    if (stmt.t === "block") {
      var best = null, bs = -1;
      for (var b = 0; b < stmt.body.length; b++) {
        var c = findEntryCall(stmt.body[b], funcs);
        if (!c) continue;
        for (var j = 0; j < funcs.length; j++) {
          if (funcs[j].name === c.name) {
            var sc = arrScore(funcs[j]);
            if (sc > bs) { best = c; bs = sc; }
            break;
          }
        }
      }
      return best;
    }
    if (stmt.t === "if") return findEntryCall(stmt.then, funcs) || findEntryCall(stmt.els, funcs);
    if (stmt.t === "for") return findEntryCall(stmt.init, funcs) || findEntryCall(stmt.body, funcs);
    if (stmt.t === "while" || stmt.t === "do") return findEntryCall(stmt.body, funcs);
    return null;
  }

  Exec.prototype.collectArrayNames = function () {
    var names = {};
    for (var i = 0; i < this.prog.funcs.length; i++) {
      var f = this.prog.funcs[i];
      for (var p = 0; p < f.params.length; p++) if (f.params[p].isArray) names[f.params[p].name] = 1;
      for (var d = 0; d < f.arrayDecls.length; d++) names[f.arrayDecls[d].name] = 1;
    }
    return names;
  };

  /* main 调用实参里的标量求值：字面量 + 数组长度符号（n 等）+ 简单算术 */
  Exec.prototype.entryVal = function (ast, line) {
    if (!ast) return this.optSize;
    switch (ast.t) {
      case "num": return Number(ast.v);
      case "var": return this.main.arr.length;
      case "binary": {
        var l = this.entryVal(ast.l, line);
        var r = this.entryVal(ast.r, line);
        return this.binOp(ast.op, l, r, line);
      }
      case "unary":
        if (ast.op === "-") return -this.entryVal(ast.operand, line);
        if (ast.op === "+") return this.entryVal(ast.operand, line);
        throw new CSimError(line, "main 调用参数暂不支持该运算，请改用数字或 n-1 之类表达式");
      default:
        throw new CSimError(line, "main 调用参数必须是数字或算术表达式（如 n、n-1、0）");
    }
  };

  Exec.prototype.execute = function () {
    var funcs = this.prog.funcs;
    var mainF = null;
    for (var mi = 0; mi < funcs.length; mi++) if (funcs[mi].name === "main") { mainF = funcs[mi]; break; }

    /* 链表/树/图模式：真实执行 main */
    if (this.mode === "list" || this.mode === "tree" || this.mode === "graph") {
      if (!mainF) {
        throw new CSimError(1, "链表代码需要包含 main 函数（程序从 main 开始真实执行）");
      }
      this.pushStep(mainF.line, "真实执行 main()，演示链表操作");
      this.stepPushedThisStmt = true;
      this.callFunction(mainF, [], mainF.line, true);
      this.finishStep();
      return;
    }

    /* 数组模式：main 存在且涉及数组（声明或调用）→ 真实执行 main，
       数组操作（写入/读取）自然产生动画；首步由数组初始化产生（测试与旧行为一致） */
    if (mainF && (mainF.hasArray || findEntryCall(mainF.body, funcs))) {
      this.callFunction(mainF, [], mainF.line, true);
      this.finishStep();
      return;
    }

    var F = null, entryCall = null;
    if (mainF) {
      entryCall = findEntryCall(mainF.body, funcs);
      if (entryCall) {
        for (var fc = 0; fc < funcs.length; fc++) {
          if (funcs[fc].name === entryCall.name) { F = funcs[fc]; break; }
        }
      }
    }
    if (!F) {
      /* 回退：打分最高的非 main 含数组函数 */
      var best = null, bs = -1;
      for (var j = 0; j < funcs.length; j++) {
        var f = funcs[j];
        if (f.name === "main" || !f.hasArray) continue;
        var s = arrScore(f);
        if (s > bs) { best = f; bs = s; }
      }
      F = best;
    }
    if (!F) {
      F = funcs.filter(function (x) { return x.name === "main" && x.hasArray; })[0] || null;
      if (!F) throw new CSimError(1, "未找到包含 int 数组（声明或参数）的代码，无法生成数组动画");
    }
    /* 初值来源（不使用随机数据时）：
       算法函数体内第一个带初值的数组声明；否则其它函数（含 main）里的第一个带初值数组声明 */
    var iniDecl = F.arrayDecls.filter(function (d) { return d.init; })[0] || null;
    if (!iniDecl && !this.forceRandom) {
      for (var j2 = 0; j2 < funcs.length; j2++) {
        if (funcs[j2] === F) continue;
        var d = funcs[j2].arrayDecls.filter(function (x) { return x.init; })[0];
        if (d) { iniDecl = d; break; }
      }
    }
    this.pendingIni = iniDecl ? iniDecl.init : null;

    /* 主数组名：main 调用里的数组实参名；否则 F 的数组参数/声明名 */
    var arrNames = this.collectArrayNames();
    var mainName = null;
    if (entryCall) {
      for (var k0 = 0; k0 < entryCall.args.length; k0++) {
        var a0 = entryCall.args[k0];
        if (a0.t === "var" && arrNames[a0.name]) { mainName = a0.name; break; }
      }
    }
    if (!mainName) {
      for (var k1 = 0; k1 < F.params.length; k1++) {
        if (F.params[k1].isArray) { mainName = F.params[k1].name; break; }
      }
    }
    if (!mainName && F.arrayDecls.length) mainName = F.arrayDecls[0].name;
    if (!mainName) mainName = "a";

    /* 主数组数据：初值优先，否则随机 */
    var vals = null;
    if (this.pendingIni && !this.forceRandom) {
      vals = [];
      for (var k2 = 0; k2 < this.pendingIni.length; k2++) vals.push(this.evalExpr(this.pendingIni[k2]));
    }
    var len = vals ? vals.length : this.optSize;
    this.main = { isArray: true, name: mainName, arr: vals || this.randomArray(len) };

    /* 入口实参 */
    var args = [];
    if (entryCall && entryCall.args.length === F.params.length) {
      for (var p = 0; p < F.params.length; p++) {
        if (F.params[p].isArray) args.push(this.main);
        else args.push(this.entryVal(entryCall.args[p], entryCall.line));
      }
    } else {
      for (var p2 = 0; p2 < F.params.length; p2++) {
        args.push(F.params[p2].isArray ? this.main : this.main.arr.length);
      }
    }
    var aryLine = entryCall ? entryCall.line : F.line;
    this.pushStep(aryLine, "数组 " + this.main.name + " = { " + this.main.arr.join(", ") +
      " }（长度 " + this.main.arr.length + "）");
    this.pushStep(aryLine, "调用 " + F.name + "()，开始执行排序过程");
    this.stepPushedThisStmt = true;
    this.callFunction(F, args, F.line);
    this.finishStep();
  };

  /* 解析 + 执行入口 */
  function run(code, opts) {
    opts = opts || {};
    try {
      var tok = tokenize(code);
      var parser = new Parser(tok.tokens);
      var prog = parser.parseProgram();
      var exec = new Exec(prog, opts);
      exec.execute();
      return { ok: true, mode: exec.mode, lines: tok.lines, steps: exec.steps, stats: exec.stats };
    } catch (e) {
      if (e instanceof CSimError) {
        return { ok: false, error: { line: e.line, msg: e.msg } };
      }
      throw e;
    }
  }

  global.CSim = { run: run, version: "1.0" };
})(typeof window !== "undefined" ? window : global);