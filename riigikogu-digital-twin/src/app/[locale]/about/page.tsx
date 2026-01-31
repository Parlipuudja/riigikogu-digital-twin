import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="space-y-6">
          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle>{t("methodology.title")}</CardTitle>
              <CardDescription>{t("methodology.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>{t("methodology.steps.1")}</li>
                <li>{t("methodology.steps.2")}</li>
                <li>{t("methodology.steps.3")}</li>
                <li>{t("methodology.steps.4")}</li>
              </ol>
            </CardContent>
          </Card>

          {/* Data Sources */}
          <Card>
            <CardHeader>
              <CardTitle>{t("data.title")}</CardTitle>
              <CardDescription>{t("data.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>{t("data.sources.votes")}</li>
                <li>{t("data.sources.speeches")}</li>
                <li>{t("data.sources.bills")}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Limitations */}
          <Card>
            <CardHeader>
              <CardTitle>{t("limitations.title")}</CardTitle>
              <CardDescription>{t("limitations.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>{t("limitations.factors.1")}</li>
                <li>{t("limitations.factors.2")}</li>
                <li>{t("limitations.factors.3")}</li>
                <li>{t("limitations.factors.4")}</li>
              </ul>
            </CardContent>
          </Card>

          <Separator />

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Stack</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Framework:</strong> Next.js 14 with App Router
              </p>
              <p>
                <strong>Database:</strong> PostgreSQL with pgvector extension
              </p>
              <p>
                <strong>AI Models:</strong> Claude Sonnet 4 for reasoning, OpenAI
                text-embedding-3-small for embeddings
              </p>
              <p>
                <strong>Architecture:</strong> Retrieval-Augmented Generation (RAG)
              </p>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800">Disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-700">
              <p>
                This is an experimental application for educational and research
                purposes only. Predictions are based on historical patterns and
                should not be used for any official or decision-making purposes.
                The creators are not affiliated with the Estonian Parliament or
                any political party.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
