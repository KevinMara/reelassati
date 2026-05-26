import { AppShell } from "@/components/app/AppShell";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";
import { FileText } from "lucide-react";
export default function Script() {
  return <AppShell><PlaceholderPage title="Script" icon={FileText} /></AppShell>;
}
