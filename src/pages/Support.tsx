import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { BookOpen, MessageCircle, Mail } from "lucide-react";

export default function Support() {
  const { t } = useTranslation();
  const channels = [
    { icon: BookOpen, title: t("support.docs_title"), desc: t("support.docs_desc"), action: t("support.docs_action") },
    { icon: MessageCircle, title: t("support.community_title"), desc: t("support.community_desc"), action: t("support.community_action") },
    { icon: Mail, title: t("support.email_title"), desc: t("support.email_desc"), action: t("support.email_action"), href: "mailto:support@reelassati.com" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 pt-28 pb-20">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{t("support.title")}</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("support.sub")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {channels.map((ch) => (
              <a key={ch.title} href={ch.href || "#"} className="rounded-xl border border-border bg-surface p-6 hover:shadow-card-hover transition-shadow group">
                <div className="h-10 w-10 rounded-lg bg-primary-wash flex items-center justify-center mb-4"><ch.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold mb-1">{ch.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{ch.desc}</p>
                <span className="text-sm font-medium text-primary group-hover:underline">{ch.action} &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
