import { redirect } from "next/navigation";

// Photo quality is fixed for every package now (best quality, fast upload).
export default function Quality() {
  redirect("/admin/plans");
}
