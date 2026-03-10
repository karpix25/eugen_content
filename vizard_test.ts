import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const result = await pool.query("SELECT vizard_project_id FROM videos WHERE vizard_project_id IS NOT NULL LIMIT 1");
  if (result.rows.length === 0) {
    console.log("No vizard project id found.");
    return;
  }
  const pid = result.rows[0].vizard_project_id;
  console.log("Found Project ID:", pid);
  try {
     const res = await axios.get(`https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/${pid}`, {
        headers: { 'VIZARDAI_API_KEY': process.env.VIZARD_API_KEY }
     });
     console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
     console.error(e);
  }
  process.exit(0);
}
run();
