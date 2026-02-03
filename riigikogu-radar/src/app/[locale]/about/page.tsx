import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  return {
    title: locale === "et" ? "Meist | Riigikogu Radar" : "About | Riigikogu Radar",
  };
}

export default async function AboutPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="page-container py-8">
      <h1 className="mb-8">{locale === "et" ? "Meist" : "About"}</h1>

      <div className="max-w-3xl space-y-8">
        {/* Mission */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Missioon" : "Mission"}
            </h2>
          </div>
          <div className="card-content">
            <p className="text-ink-700 leading-relaxed">
              {locale === "et"
                ? `Riigikogu Radar on sõltumatu analüüsitööriist, mille eesmärk on muuta Eesti parlamendi
                   tegevus läbipaistvamaks ja arusaadavamaks. Kasutame tehisaru ja avalikke andmeid,
                   et pakkuda andmepõhist analüüsi seadusandlike otsuste kohta.`
                : `Riigikogu Radar is an independent analysis tool designed to make the Estonian parliament
                   more transparent and understandable. We use AI and public data to provide data-driven
                   analysis of legislative decisions.`}
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="card" id="methodology">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Kuidas see töötab" : "How it works"}
            </h2>
          </div>
          <div className="card-content space-y-4">
            <div>
              <h3 className="font-medium text-ink-900 mb-1">
                {locale === "et" ? "1. Andmete kogumine" : "1. Data collection"}
              </h3>
              <p className="text-sm text-ink-600">
                {locale === "et"
                  ? "Kogume avalikke andmeid Riigikogu API-st: hääletused, stenogrammid, eelnõud ja saadikute info."
                  : "We collect public data from the Riigikogu API: votes, stenograms, drafts, and MP information."}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-ink-900 mb-1">
                {locale === "et" ? "2. Profiilide loomine" : "2. Profile generation"}
              </h3>
              <p className="text-sm text-ink-600">
                {locale === "et"
                  ? "Tehisintellekt analüüsib iga saadiku hääletusajalugu ja kõnesid, et luua poliitiline profiil."
                  : "AI analyzes each MP's voting history and speeches to create a political profile."}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-ink-900 mb-1">
                {locale === "et" ? "3. Sarnaste juhtumite otsimine" : "3. Similar case retrieval"}
              </h3>
              <p className="text-sm text-ink-600">
                {locale === "et"
                  ? "Iga ennustuse jaoks otsime vektorotsinguga sarnaseid varasemaid hääletusi kontekstiks."
                  : "For each prediction, we use vector search to find similar past votes for context."}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-ink-900 mb-1">
                {locale === "et" ? "4. Ennustuse genereerimine" : "4. Prediction generation"}
              </h3>
              <p className="text-sm text-ink-600">
                {locale === "et"
                  ? "Claude (Anthropic) genereerib ennustuse koos kindlustaseme ja põhjendusega."
                  : "Claude (Anthropic) generates a prediction with confidence level and reasoning."}
              </p>
            </div>
          </div>
        </section>

        {/* Data sources */}
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Andmeallikad" : "Data sources"}
            </h2>
          </div>
          <div className="card-content">
            <ul className="space-y-2 text-sm text-ink-700">
              <li className="flex items-start gap-2">
                <span className="text-rk-500 mt-0.5">•</span>
                <span>
                  <strong>Riigikogu Open Data API</strong> —{" "}
                  {locale === "et" ? "Hääletused, stenogrammid, eelnõud" : "Votes, stenograms, drafts"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rk-500 mt-0.5">•</span>
                <span>
                  <strong>Claude Sonnet 4</strong> (Anthropic) —{" "}
                  {locale === "et" ? "Tehisintellekti mudel" : "AI model"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rk-500 mt-0.5">•</span>
                <span>
                  <strong>Voyage AI</strong> —{" "}
                  {locale === "et" ? "Mitmekeelsed vektorotsingu manused" : "Multilingual vector embeddings"}
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* API */}
        <section className="card" id="api">
          <div className="card-header">
            <h2 className="text-lg font-semibold">API</h2>
          </div>
          <div className="card-content">
            <p className="text-ink-700 mb-4">
              {locale === "et"
                ? "Pakume REST API-t programmiliseks juurdepääsuks meie andmetele ja ennustustele."
                : "We provide a REST API for programmatic access to our data and predictions."}
            </p>
            <div className="bg-ink-50 p-4 rounded font-mono text-sm">
              <div className="text-ink-500 mb-2"># Example</div>
              <div>GET /api/v1/mps</div>
              <div>GET /api/v1/mps/:slug</div>
              <div>POST /api/v1/mps/:slug/predict</div>
              <div>POST /api/v1/simulate</div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="card" id="contact">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {locale === "et" ? "Kontakt" : "Contact"}
            </h2>
          </div>
          <div className="card-content">
            <p className="text-ink-700">
              {locale === "et"
                ? "Küsimuste, ettepanekute või koostöö osas võtke meiega ühendust:"
                : "For questions, suggestions, or collaboration, please contact us:"}
            </p>
            <p className="mt-2 text-rk-700 font-medium">info@riigikogu-radar.ee</p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="card border-ink-300">
          <div className="card-content">
            <p className="text-sm text-ink-500">
              {locale === "et"
                ? `Riigikogu Radar on sõltumatu projekt, mis ei ole seotud Riigikogu ega Eesti Vabariigi
                   valitsusega. Ennustused põhinevad avalikult kättesaadavatel andmetel ja masinõppel.
                   Tulemused on informatiivsed ega kujuta endast ametlikku seisukohta ega õigusnõuannet.`
                : `Riigikogu Radar is an independent project not affiliated with the Riigikogu or the
                   Government of Estonia. Predictions are based on publicly available data and machine
                   learning. Results are informational and do not represent official positions or legal advice.`}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
