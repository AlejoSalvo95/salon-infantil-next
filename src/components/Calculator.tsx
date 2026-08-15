import { extras, money, packages, type Extra, type PackageName } from "@/lib/data";
type Props={kids:number;setKids:(n:number)=>void;selectedExtras:Extra[];setExtras:(x:Extra[])=>void;packageName:PackageName;setPackage:(x:PackageName)=>void;onBook:()=>void};
export function Calculator(p:Props){
  const toggle=(extra:Extra)=>p.setExtras(p.selectedExtras.some(x=>x.name===extra.name)?p.selectedExtras.filter(x=>x.name!==extra.name):[...p.selectedExtras,extra]);
  const total=packages.find(x=>x.name===p.packageName)!.price+p.selectedExtras.reduce((a,x)=>a+x.price,0);
  const updateKids=(n:number)=>{p.setKids(n);p.setPackage(n<=15?"Mini":n<=25?"Nube":"Fiestón")};
  return <section className="calculator section"><div><p className="kicker">Armá tu celebración</p><h2>Calculá tu fiesta<br/>en un minuto.</h2><p>Elegí lo que necesitás y obtené un estimado al instante. Sin compromisos.</p></div><div className="calc-card"><label>¿Cuántos niños?<output>{p.kids}</output></label><input type="range" min="10" max="40" value={p.kids} onChange={e=>updateKids(Number(e.target.value))}/><div className="calc-row">{extras.map(extra=><label key={extra.name}><input type="checkbox" checked={p.selectedExtras.some(x=>x.name===extra.name)} onChange={()=>toggle(extra)}/><span>{extra.name}</span><b>+{money(extra.price)}</b></label>)}</div><div className="total"><span>Estimado desde<small>Precio final sujeto a fecha y detalles</small></span><strong>{money(total)}</strong></div><button className="primary full" onClick={p.onBook}>Consultar esta fiesta <span>→</span></button></div></section>;
}
