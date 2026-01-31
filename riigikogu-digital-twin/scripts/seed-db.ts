/**
 * Seed the database with sample data for development
 * Usage: npm run db:seed
 */

import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/riigikogu';

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
};

const MP_UUID = '36a13f33-bfa9-4608-b686-4d7a4d33fdc4';
const MP_NAME = 'Tõnis Lukas';
const PARTY = 'Isamaa';

// Sample voting data based on typical parliamentary votes
const sampleVotes = [
  {
    votingTitle: '2024. aasta riigieelarve seaduse eelnõu (300 SE) kolmas lugemine',
    decision: 'FOR',
    date: '2023-12-14',
  },
  {
    votingTitle: 'Eesti keele seaduse muutmise seaduse eelnõu (245 SE) teine lugemine',
    decision: 'FOR',
    date: '2023-11-22',
  },
  {
    votingTitle: 'Haridusseaduse ja põhikooli- ja gümnaasiumiseaduse muutmise seaduse eelnõu (189 SE)',
    decision: 'FOR',
    date: '2023-10-18',
  },
  {
    votingTitle: 'Kultuurkapitali seaduse muutmise seaduse eelnõu (156 SE)',
    decision: 'FOR',
    date: '2023-09-27',
  },
  {
    votingTitle: 'Umbusalduse avaldamine kultuuriministrile',
    decision: 'AGAINST',
    date: '2023-09-14',
  },
  {
    votingTitle: 'Riigikogu otsuse "Rahvahääletuse korraldamine abielu mõiste küsimuses" eelnõu (OE 87)',
    decision: 'FOR',
    date: '2023-06-08',
  },
  {
    votingTitle: 'Kooseluseaduse kehtetuks tunnistamise seaduse eelnõu (185 SE)',
    decision: 'FOR',
    date: '2023-06-07',
  },
  {
    votingTitle: 'Muinsuskaitseseaduse muutmise seaduse eelnõu (167 SE)',
    decision: 'FOR',
    date: '2023-05-24',
  },
  {
    votingTitle: 'Valitsuse usaldamise hääletus',
    decision: 'AGAINST',
    date: '2023-05-10',
  },
  {
    votingTitle: 'Eesti Vabariigi ja Euroopa Liidu vahelise lepingu ratifitseerimine',
    decision: 'FOR',
    date: '2023-04-26',
  },
];

// Sample speeches
const sampleSpeeches = [
  {
    topic: 'Eesti keele kaitse ja arendamine',
    fullText: `Austatud juhataja, head kolleegid! Eesti keel on meie rahvuse alus ja vundament.
    Me peame tagama, et eesti keel jääb riigi- ja hariduskeeleks kõigis Eesti koolides.
    Hariduse kaudu tagame keele püsimise ja arengu. Iga Eesti kool peab olema eestikeelne.
    See on meie kohustus tulevaste põlvkondade ees.`,
    sessionDate: '2023-11-15',
  },
  {
    topic: 'Kultuuripoliitika põhialused',
    fullText: `Kultuur on rahva hing ja identiteet. Eesti kultuuri edendamine nõuab süsteemset tööd.
    Peame toetama nii rahvakultuuri kui professionaalset kunstiloomet.
    Kultuurkapitali töö on olnud tulemuslik, kuid ressursse on vaja juurde.
    Meie laulu- ja tantsupidude traditsioon on UNESCO maailmapärandi nimistusse kantud põhjusega.`,
    sessionDate: '2023-10-25',
  },
  {
    topic: 'Haridusreform ja õppekavad',
    fullText: `Haridus on investeering tulevikku. Õppekavade ajakohastamine on vajalik,
    kuid peame säilitama Eesti hariduse tugevused - üldhariduse laiapõhjalisuse.
    Kutseharidus vajab väärtustamist. Õpetajate palga tõstmine peab olema prioriteet.
    Digipööre hariduses ei tohi tähendada põhiväärtuste kaotust.`,
    sessionDate: '2023-09-20',
  },
  {
    topic: 'Riigieelarve arutelu',
    fullText: `Eelarve on poliitika numbrites. See peegeldab meie väärtusi ja prioriteete.
    Kultuurivaldkonna rahastamine peab olema stabiilne ja ennustatav.
    Hariduskulutused on investeering, mitte kulu. Teadus- ja arendustegevuse toetamine
    on Eesti konkurentsivõime alus.`,
    sessionDate: '2023-11-30',
  },
  {
    topic: 'Perekonna ja traditsionaalsete väärtuste kaitse',
    fullText: `Perekond on ühiskonna alustala. Traditsionaalne perekond - mehe ja naise liit -
    väärib kaitset ja toetust. See ei tähenda kellegi diskrimineerimist,
    vaid meie kultuurilise järjepidevuse tagamist. Rahvahääletus annaks rahvale sõna.`,
    sessionDate: '2023-06-05',
  },
];

async function seedDatabase(): Promise<void> {
  const client = new MongoClient(uri, clientOptions);

  try {
    await client.connect();
    const db = client.db();

    console.log('Seeding votes...');
    const votesCollection = db.collection('votes');

    const voteDocuments = sampleVotes.map((vote) => ({
      id: uuidv4(),
      voting_id: uuidv4(),
      mp_uuid: MP_UUID,
      mp_name: MP_NAME,
      party: PARTY,
      decision: vote.decision,
      voting_title: vote.votingTitle,
      date: vote.date,
    }));

    // Use insertMany with ordered: false to skip duplicates
    try {
      await votesCollection.insertMany(voteDocuments, { ordered: false });
    } catch (e: unknown) {
      // Ignore duplicate key errors
      if ((e as { code?: number }).code !== 11000) throw e;
    }
    console.log(`  Inserted ${sampleVotes.length} votes`);

    console.log('Seeding speeches...');
    const speechesCollection = db.collection('speeches');

    const speechDocuments = sampleSpeeches.map((speech) => ({
      id: uuidv4(),
      mp_uuid: MP_UUID,
      session_date: speech.sessionDate,
      session_type: 'PLENARY',
      topic: speech.topic,
      full_text: speech.fullText,
    }));

    try {
      await speechesCollection.insertMany(speechDocuments, { ordered: false });
    } catch (e: unknown) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
    console.log(`  Inserted ${sampleSpeeches.length} speeches`);

    console.log('\nDatabase seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  try {
    await seedDatabase();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
