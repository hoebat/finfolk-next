// Loaded before stylesheets to apply saved colours before the first paint.
(() => {
  const themes=Object.freeze([
    {id:'yellow',workspace:{canvas:'#edff35',surface:'#f7ffad',ink:'#172440',muted:'#45516b',line:'#b3c43c',accent:'#172440',onAccent:'#edff35',focus:'#172440',chart:'#33636b',chartAlt:'#4e557b'},name:'Acid Club',detail:'Acid yellow · bold print',collection:'hyper',bg:'#edff35',surface:'#172440',ink:'#172440',accent:'#172440',onAccent:'#edff35',muted:'#45516b',line:'#adb484',focus:'#172440',danger:'#a60045'},
    {id:'cobalt',workspace:{canvas:'#101b49',surface:'#172859',ink:'#f4f6ff',muted:'#bac8ee',line:'#3a4e84',accent:'#c0d2ff',onAccent:'#142146',focus:'#edff35',chart:'#93caff',chartAlt:'#c8baed'},name:'Blue Hour',detail:'Electric cobalt · warm ivory',collection:'hyper',bg:'#1641ff',surface:'#2039b9',ink:'#fff4d8',accent:'#edff35',onAccent:'#172440',muted:'#d5ddff',line:'#7087e8',focus:'#edff35',danger:'#ffb8d5'},
    {id:'navy-light',workspace:{canvas:'#f5f0e6',surface:'#fffaf1',ink:'#651a45',muted:'#7a4b64',line:'#d8becb',accent:'#a51d63',onAccent:'#fffaf0',focus:'#a51d63',chart:'#a51d63',chartAlt:'#765174'},name:'Salt Paper',detail:'Warm ivory · magenta ink',collection:'muted',bg:'#f2e8d6',surface:'#fffaf0',ink:'#651a45',accent:'#a51d63',onAccent:'#fffaf0',muted:'#75495e',line:'#c9aeba',focus:'#a51d63',danger:'#a60045'},
    {id:'navy',workspace:{canvas:'#101c2e',surface:'#19283e',ink:'#edf1f7',muted:'#b1bfd2',line:'#3c4d66',accent:'#edb2c7',onAccent:'#172440',focus:'#edb2c7',chart:'#7bc4c7',chartAlt:'#bdabd9'},name:'Night Swim',detail:'Midnight ink · restrained print',collection:'muted',bg:'#172440',surface:'#223351',ink:'#f2e8d6',accent:'#edb2c7',onAccent:'#172440',muted:'#bec9da',line:'#56647c',focus:'#edb2c7',danger:'#ffb8d5'},
  ].map(theme=>Object.freeze({...theme,workspace:Object.freeze(theme.workspace)})));
  const aliases={coastal:'navy-light',sand:'navy-light',night:'navy'};
  const resolve=id=>themes.find(theme=>theme.id===(aliases[id]||id))||themes[0];
  function apply(id) {
    const theme=resolve(id),root=document.documentElement;
    root.dataset.theme=theme.id;root.dataset.printCollection=theme.collection;
    for(const key of ['bg','surface','ink','accent','onAccent','muted','line','focus','danger'])root.style.setProperty('--theme-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),theme[key]);
    root.style.setProperty('--theme-on-surface',theme.id==='yellow'?theme.onAccent:theme.ink);
    root.style.setProperty('--theme-surface-muted',theme.id==='yellow'?'#d6df8b':theme.muted);
    root.style.setProperty('--theme-surface-line',theme.id==='yellow'?'#89964f':theme.line);
    for(const [key,value] of Object.entries(theme.workspace))root.style.setProperty('--workspace-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),value);
    root.style.colorScheme=['navy','cobalt'].includes(theme.id)?'dark':'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.bg);
    return theme;
  }
  function saved() {
    let id;try{id=localStorage.getItem('finfolk-theme');}catch{}
    const theme=apply(id);
    if(id&&id!==theme.id)try{localStorage.setItem('finfolk-theme',theme.id);}catch{}
    return theme;
  }
  globalThis.FinFolkAppearance={themes,resolve,apply,saved};
  if(globalThis.document)saved();
})();
