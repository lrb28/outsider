import { ImageResponse } from "next/og";
export const alt = "Outsider – Öffentliche Meldungen verstehen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() { return new ImageResponse(<div style={{width:"100%",height:"100%",background:"#0f172a",color:"white",display:"flex",flexDirection:"column",padding:80,justifyContent:"space-between"}}><div style={{fontSize:32,color:"#a5b4fc"}}>OUTSIDER</div><div style={{display:"flex",flexDirection:"column",fontSize:76,fontWeight:700,lineHeight:1.05}}>Die Meldung dahinter.<br/>Dein eigener Blick.</div><div style={{fontSize:26,color:"#cbd5e1"}}>Investoren · Unternehmensinsider · US-Politiker</div></div>, size); }
