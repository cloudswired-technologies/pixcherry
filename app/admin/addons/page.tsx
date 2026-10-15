import { redirect } from "next/navigation";

// Add-ons live on the Packages page now.
export default function Addons() {
  redirect("/admin/plans?tab=addons");
}
