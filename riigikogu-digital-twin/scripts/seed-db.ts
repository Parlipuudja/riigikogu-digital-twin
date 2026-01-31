/**
 * Seed the database with sample data for development
 * Usage: npm run db:seed
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/riigikogu',
});

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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Seeding votes...');
    for (const vote of sampleVotes) {
      const id = uuidv4();
      const votingId = uuidv4();

      await client.query(
        `INSERT INTO votes (id, voting_id, mp_uuid, mp_name, party, decision, voting_title, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [id, votingId, MP_UUID, MP_NAME, PARTY, vote.decision, vote.votingTitle, vote.date]
      );
    }
    console.log(`  Inserted ${sampleVotes.length} votes`);

    console.log('Seeding speeches...');
    for (const speech of sampleSpeeches) {
      const id = uuidv4();

      await client.query(
        `INSERT INTO speeches (id, mp_uuid, session_date, session_type, topic, full_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [id, MP_UUID, speech.sessionDate, 'PLENARY', speech.topic, speech.fullText]
      );
    }
    console.log(`  Inserted ${sampleSpeeches.length} speeches`);

    await client.query('COMMIT');
    console.log('\nDatabase seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  try {
    await seedDatabase();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
