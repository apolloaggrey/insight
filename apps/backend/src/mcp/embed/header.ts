export const SANDBOX_ICON_DOWNLOAD =
	'<svg class="insight-mcp-btn-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';

export const SANDBOX_ICON_EXTERNAL_LINK =
	'<svg class="insight-mcp-btn-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

export const SANDBOX_APP_HEADER_CSS = `
[data-insight-mcp-app-header]{
  display:flex;
  flex-shrink:0;
  align-items:center;
  gap:12px;
  min-width:0;
  min-height:0;
  box-sizing:border-box;
  color-scheme:light;
  border-bottom:1px solid oklch(0 0 0 / 0.1);
  background:oklch(1 0 0);
  padding:12px 16px;
  margin:0 -24px 16px;
  width:calc(100% + 48px);
  font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:oklch(0.2 0.02 260);
}
@media (min-width: 768px){
  [data-insight-mcp-app-header]{padding:16px 24px}
}
[data-insight-mcp-app-header] h1{
  margin:0;
  flex:1 1 0%;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:1rem;
  font-weight:500;
  line-height:1.5;
}
[data-insight-mcp-app-header] .insight-mcp-header-actions{
  margin-left:auto;
  display:flex;
  flex-shrink:0;
  align-items:center;
  gap:6px;
}
[data-insight-mcp-app-header] .insight-mcp-btn-icon{
  width:14px;
  height:14px;
  flex-shrink:0;
  display:block;
  pointer-events:none;
}
[data-insight-mcp-app-header] .insight-mcp-btn-text{
  display:none;
}
@media (min-width: 640px){
  [data-insight-mcp-app-header] .insight-mcp-btn-text{display:inline}
}
[data-insight-mcp-app-header] .insight-mcp-btn{
  cursor:pointer;
  box-sizing:border-box;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  height:28px;
  min-height:28px;
  padding:0 12px;
  border-radius:6px;
  border:1px solid oklch(0 0 0 / 0.12);
  background:oklch(1 0 0);
  color:inherit;
  font:inherit;
  font-size:0.875rem;
  line-height:1.25;
  font-weight:500;
  box-shadow:0 1px 2px oklch(0 0 0 / 0.04);
  transition:background 0.15s ease,color 0.15s ease,border-color 0.15s ease;
}
[data-insight-mcp-app-header] .insight-mcp-btn:hover{
  background:oklch(0.97 0.005 260);
  border-color:oklch(0 0 0 / 0.18);
}
[data-insight-mcp-app-header] .insight-mcp-dl-wrap{position:relative}
[data-insight-mcp-app-header] .insight-mcp-menu{
  display:none;
  position:absolute;
  right:0;
  top:100%;
  margin-top:4px;
  min-width:10rem;
  border:1px solid oklch(0 0 0 / 0.1);
  border-radius:6px;
  background:oklch(1 0 0);
  padding:4px 0;
  box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1);
  z-index:50;
}
[data-insight-mcp-app-header] .insight-mcp-menu .insight-mcp-menuitem{
  display:flex;
  width:100%;
  text-align:left;
  border:none;
  background:transparent;
  padding:8px 12px;
  font:inherit;
  font-size:0.875rem;
  cursor:pointer;
  color:inherit;
}
[data-insight-mcp-app-header] .insight-mcp-menu .insight-mcp-menuitem:hover{background:oklch(0.97 0.005 260)}
`;

export const SANDBOX_EMBED_PANEL_BODY_CSS = `
html{margin:0 !important;color-scheme:light}
body{
  background:oklch(1 0 0) !important;
  margin-top:0 !important;
  padding-top:0 !important;
}
`;

export const SANDBOX_EMBED_ROOT_STYLES = `<style data-insight-mcp-embed>
html{height:auto!important;min-height:0!important;overflow-x:hidden}
body{height:auto!important;min-height:0!important;overflow-x:hidden;overflow-y:visible}
${SANDBOX_APP_HEADER_CSS}
${SANDBOX_EMBED_PANEL_BODY_CSS}
</style>`;
