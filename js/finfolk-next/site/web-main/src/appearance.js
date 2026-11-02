// Loaded before stylesheets to apply saved colours before the first paint.
(() => {
  const themes=Object.freeze([
    {id:'yellow',name:'Acid Club',detail:'Acid yellow · bold print',collection:'hyper',bg:'#edff35',surface:'#fffbea',ink:'#172440',accent:'#1641ff',onAccent:'#ffffff',muted:'#45516b',line:'#adb484',focus:'#172440',danger:'#a60045'},
    {id:'cobalt',name:'Blue Hour',detail:'Electric cobalt · warm ivory',collection:'hyper',bg:'#1641ff',surface:'#2039b9',ink:'#fff4d8',accent:'#edff35',onAccent:'#172440',muted:'#d5ddff',line:'#7087e8',focus:'#edff35',danger:'#ffb8d5'},
    {id:'navy-light',name:'Salt Paper',detail:'Warm ivory · quiet navy ink',collection:'muted',bg:'#f2e8d6',surface:'#fffaf0',ink:'#172440',accent:'#83445e',onAccent:'#ffffff',muted:'#5a6170',line:'#c3b9ab',focus:'#83445e',danger:'#a60045'},
    {id:'navy',name:'Night Swim',detail:'Midnight ink · restrained print',collection:'muted',bg:'#172440',surface:'#223351',ink:'#f2e8d6',accent:'#edb2c7',onAccent:'#172440',muted:'#bec9da',line:'#56647c',focus:'#edb2c7',danger:'#ffb8d5'},
  ].map(Object.freeze));
  const aliases={coastal:'navy-light',sand:'navy-light',night:'navy'};
  const resolve=id=>themes.find(theme=>theme.id===(aliases[id]||id))||themes[0];
  function apply(id) {
    const theme=resolve(id),root=document.documentElement;
    root.dataset.theme=theme.id;root.dataset.printCollection=theme.collection;
    for(const key of ['bg','surface','ink','accent','onAccent','muted','line','focus','danger'])root.style.setProperty('--theme-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),theme[key]);
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
