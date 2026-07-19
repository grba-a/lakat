import { redirect } from "next/navigation";

// /liga je 2.x ruta — Rang 3.0 živi na /rang (stari linkovi ne smiju pucati)
export default function LigaRedirect() {
  redirect("/rang");
}
