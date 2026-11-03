'use strict';
// The string literals of a JavaScript source, comments excluded: single, double and template quotes (the text of a template, its ${} expressions scanned as code),
// each as { text, line }. A small lexer, not a parser: it tracks line and block comments, strings, templates with nested ${} and regex literals (a '/' after an
// operator, an opening bracket, a comma or a keyword starts one), so a quote inside a comment or a regex is not mistaken for a string.
const REGEX_PREV = /[(,=:[!&|?{};+\-*%<>~^]$|\b(return|typeof|case|in|of|delete|void|throw|new|else|do)$/;

function stringLiterals(src){
  const out = [];
  let i = 0, line = 1, last = '';           // `last`: the source of the tokens so far, trimmed to what matters for the regex test
  const n = src.length;
  const stack = [];                          // template nesting: each entry is the brace depth at which its ${ opened
  let depth = 0;
  const nl = c => { if(c === '\n') line++; };
  function readString(q){
    let text = '', start = line;
    i++;
    while(i < n && src[i] !== q){
      if(src[i] === '\\'){ text += src[i] + (src[i + 1] || ''); nl(src[i + 1]); i += 2; continue; }
      if(src[i] === '\n') break;
      text += src[i++];
    }
    i++;
    out.push({ text, line: start });
    last = '"x"';
  }
  function readTemplate(){
    // at the opening backtick (or just after a closing } of a ${ expression): read text up to ${ or the closing backtick
    let text = '', start = line;
    while(i < n){
      const c = src[i];
      if(c === '\\'){ text += c + (src[i + 1] || ''); nl(src[i + 1]); i += 2; continue; }
      if(c === '`'){ i++; out.push({ text, line: start }); last = '"x"'; return; }
      if(c === '$' && src[i + 1] === '{'){ i += 2; out.push({ text, line: start }); stack.push(depth); depth++; last = '('; return; }
      nl(c); text += c; i++;
    }
  }
  while(i < n){
    const c = src[i], d = src[i + 1];
    if(c === '\n'){ line++; i++; continue; }
    if(/\s/.test(c)){ i++; continue; }
    if(c === '/' && d === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
    if(c === '/' && d === '*'){ i += 2; while(i < n && !(src[i] === '*' && src[i + 1] === '/')){ nl(src[i]); i++; } i += 2; continue; }
    if(c === '"' || c === "'"){ readString(c); continue; }
    if(c === '`'){ i++; readTemplate(); continue; }
    if(c === '/' ){
      if(!last || REGEX_PREV.test(last)){
        // a regex literal: to the closing unescaped / outside a class
        i++; let cls = false;
        while(i < n && src[i] !== '\n'){
          if(src[i] === '\\'){ i += 2; continue; }
          if(src[i] === '[') cls = true; else if(src[i] === ']') cls = false; else if(src[i] === '/' && !cls){ i++; break; }
          i++;
        }
        while(i < n && /[a-z]/i.test(src[i])) i++;
        last = '"x"';
        continue;
      }
      last += '/'; i++; continue;
    }
    if(c === '{'){ depth++; last = '{'; i++; continue; }
    if(c === '}'){
      depth--; i++;
      if(stack.length && stack[stack.length - 1] === depth){ stack.pop(); readTemplate(); continue; }
      last = '}'; continue;
    }
    if(/[A-Za-z_$0-9]/.test(c)){
      let w = ''; while(i < n && /[A-Za-z_$0-9]/.test(src[i])) w += src[i++];
      last = (last + ' ' + w).slice(-20); continue;
    }
    last = c; i++;
  }
  return out;
}

module.exports = { stringLiterals };
