import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PredictionForm } from "@/components/forms/prediction-form";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: `Riigikogu Radar | ${t("hero.subtitle")}`,
    description: t("hero.subtitle"),
  };
}

export default function HomePage() {
  return (
    <div className="page-container py-12">
      {/* Hero section */}
      <HeroSection />

      {/* Main content grid */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Upcoming votes */}
        <div className="lg:col-span-1">
          <UpcomingVotes />
        </div>

        {/* Right column - Recent predictions & Accuracy */}
        <div className="lg:col-span-2 space-y-8">
          <RecentPredictions />
          <AccuracyPanel />
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  const t = useTranslations("home");

  return (
    <section className="text-center">
      <h1 className="text-4xl font-semibold text-ink-900 mb-3">
        {t("hero.title")}
      </h1>
      <p className="text-lg text-ink-600 mb-8 max-w-2xl mx-auto">
        {t("hero.subtitle")}
      </p>

      {/* Prediction form */}
      <div className="max-w-2xl mx-auto">
        <PredictionForm />
      </div>
    </section>
  );
}

function UpcomingVotes() {
  const t = useTranslations("home.upcoming");

  // TODO: Fetch from API
  const upcomingVotes = [
    { id: "142-se", title: "Tulumaksuseaduse muutmine (142 SE)", date: "5. veebruar" },
    { id: "156-se", title: "Isikuandmete kaitse seadus (156 SE)", date: "8. veebruar" },
    { id: "161-se", title: "Riigikaitse seaduse muutmine (161 SE)", date: "12. veebruar" },
  ];

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
      </div>
      <div className="card-content">
        {upcomingVotes.length > 0 ? (
          <ul className="space-y-4">
            {upcomingVotes.map((vote) => (
              <li key={vote.id}>
                <Link
                  href={`/drafts/${vote.id}`}
                  className="block group"
                >
                  <div className="text-sm font-medium text-ink-900 group-hover:text-rk-700">
                    {vote.title}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {vote.date}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-500">No upcoming votes scheduled.</p>
        )}

        <Link
          href="/drafts"
          className="block mt-4 text-sm text-rk-700 hover:text-rk-500"
        >
          {t("title")} &rarr;
        </Link>
      </div>
    </section>
  );
}

function RecentPredictions() {
  const t = useTranslations("home.recent");

  // TODO: Fetch from API
  const recentPredictions = [
    {
      id: "1",
      title: "Tulumaksuseaduse muutmine (138 SE)",
      probability: 78,
      date: "1. veebruar",
    },
    {
      id: "2",
      title: "Keskkonnaseaduse muutmine (135 SE)",
      probability: 34,
      date: "30. jaanuar",
    },
  ];

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
      </div>
      <div className="card-content">
        <div className="space-y-4">
          {recentPredictions.map((prediction) => (
            <div
              key={prediction.id}
              className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-ink-900">
                  {prediction.title}
                </div>
                <div className="text-xs text-ink-500 mt-0.5">
                  Predicted: {prediction.date}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-lg font-mono font-semibold ${
                    prediction.probability >= 50 ? "text-conf-high" : "text-conf-low"
                  }`}
                >
                  {prediction.probability}%
                </div>
                <div className="text-xs text-ink-500">
                  {prediction.probability >= 50 ? "likely to pass" : "likely to fail"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccuracyPanel() {
  const t = useTranslations("home.accuracy");

  // TODO: Fetch from API
  const accuracy = {
    overall: 73.2,
    for: 81,
    against: 68,
  };

  return (
    <section className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
        <span className="text-xs text-ink-500">{t("last30")}</span>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-rk-700">
              {accuracy.overall}%
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("overall")}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-vote-for">
              {accuracy.for}%
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("for")}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-vote-against">
              {accuracy.against}%
            </div>
            <div className="text-xs text-ink-500 mt-1">{t("against")}</div>
          </div>
        </div>

        <Link
          href="/accuracy"
          className="block mt-6 text-sm text-center text-rk-700 hover:text-rk-500"
        >
          {t("methodology")} &rarr;
        </Link>
      </div>
    </section>
  );
}
