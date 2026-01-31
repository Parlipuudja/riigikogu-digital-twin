import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, History, Vote } from "lucide-react";

export default function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = useTranslations("home");

  const features = [
    {
      icon: Vote,
      title: t("features.predict.title"),
      description: t("features.predict.description"),
      href: `/${locale}/predict`,
    },
    {
      icon: History,
      title: t("features.history.title"),
      description: t("features.history.description"),
      href: `/${locale}/history`,
    },
    {
      icon: BarChart3,
      title: t("features.evaluate.title"),
      description: t("features.evaluate.description"),
      href: `/${locale}/evaluate`,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground mb-4">{t("subtitle")}</p>
        <p className="text-muted-foreground mb-8">{t("description")}</p>
        <Button asChild size="lg">
          <Link href={`/${locale}/predict`}>{t("cta")}</Link>
        </Button>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <feature.icon className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Info Section */}
      <Card className="max-w-3xl mx-auto mt-16">
        <CardHeader>
          <CardTitle>Tõnis Lukas</CardTitle>
          <CardDescription>Isamaa faction member</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Tõnis Lukas is a member of the Estonian Parliament (Riigikogu)
            representing the Isamaa party. He has served as Minister of
            Education and Research and Minister of Culture.
          </p>
          <p>
            This application uses his historical voting record and public
            speeches to predict how he might vote on new legislation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
