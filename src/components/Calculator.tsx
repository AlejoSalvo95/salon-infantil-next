import { extras, money, packages, type Extra, type PackageName } from "@/lib/data";
type Props={kids:number;setKids:(n:number)=>void;selectedExtras:Extra[];setExtras:(x:Extra[])=>void;packageName:PackageName;setPackage:(x:PackageName)=>void;onBook:()=>void};
export function Calculator(p:Props){
  const toggle=(extra:Extra)=>p.setExtras(p.selectedExtras.some(x=>x.name===extra.name)?p.selectedExtras.filter(x=>x.name!==extra.name):[...p.selectedExtras,extra]);
  const total=packages.find(x=>x.name===p.packageName)!.price+p.selectedExtras.reduce((a,x)=>a+x.price,0);
  const updateKids=(n:number)=>{p.setKids(n);p.setPackage(n<=15?"Mini":n<=25?"Nube":"Fiestón")};
  return <section className="calculator section"><div><p className="kicker">Plan your garden session</p><h2>Build your program<br/>in one minute.</h2><p>Choose what your group needs and get an instant estimate.</p></div><div className="calc-card"><label>How many young growers?<output>{p.kids}</output></label><input type="range" min="10" max="40" value={p.kids} onChange={e=>updateKids(Number(e.target.value))}/><div className="calc-row">{extras.map(extra=><label key={extra.name}><input type="checkbox" checked={p.selectedExtras.some(x=>x.name===extra.name)} onChange={()=>toggle(extra)}/><span>{extra.name}</span><b>+{money(extra.price)}</b></label>)}</div><div className="total"><span>Estimate from<small>Final price depends on date and program details</small></span><strong>{money(total)}</strong></div><button className="primary full" onClick={p.onBook}>Ask about this program <span>→</span></button></div></section>;
}
