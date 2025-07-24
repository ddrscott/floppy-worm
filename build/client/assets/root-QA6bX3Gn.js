import{r as a,j as e}from"./index-DogrX72I.js";import{l as h,n as y,o as x,p as w,_ as S,O as f,M as g,L as j,S as b}from"./components-DKNBMGd9.js";/**
 * @remix-run/react v2.16.8
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let i="positions";function k({getKey:t,...l}){let{isSpaMode:c}=h(),r=y(),m=x();w({getKey:t,storageKey:i});let u=a.useMemo(()=>{if(!t)return null;let s=t(r,m);return s!==r.key?s:null},[]);if(c)return null;let p=((s,d)=>{if(!window.history.state||!window.history.state.key){let o=Math.random().toString(32).slice(2);window.history.replaceState({key:o},"")}try{let n=JSON.parse(sessionStorage.getItem(s)||"{}")[d||window.history.state.key];typeof n=="number"&&window.scrollTo(0,n)}catch(o){console.error(o),sessionStorage.removeItem(s)}}).toString();return a.createElement("script",S({},l,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${p})(${JSON.stringify(i)}, ${JSON.stringify(u)})`}}))}const L=()=>[];function _({children:t}){return e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx("meta",{name:"viewport",content:"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"}),e.jsx("meta",{name:"apple-mobile-web-app-capable",content:"yes"}),e.jsx("meta",{name:"mobile-web-app-capable",content:"yes"}),e.jsx(g,{}),e.jsx(j,{}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              background-color: #333333;
            }
            
            #game-container {
              width: 100vw;
              height: 100vh;
            }
          `}})]}),e.jsxs("body",{children:[t,e.jsx(k,{}),e.jsx(b,{})]})]})}function O(){return e.jsx(f,{})}export{_ as Layout,O as default,L as links};
