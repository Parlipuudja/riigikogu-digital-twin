import { getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-lg text-muted-foreground">{t("description")}</p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("methodology")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{t("methodologyText")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dataSources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{t("dataSourcesText")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("philosophy")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{t("philosophyText")}</p>
            <Separator className="my-4" />
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Transparency &gt; magic</li>
              <li>Accuracy &gt; speed</li>
              <li>Autonomy &gt; dependency</li>
              <li>Reliability &gt; features</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
