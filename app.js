const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http:/localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdfghjklzxcvbnm");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Token Authentication MiddleWare Handler Function
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjklzxcvbnm", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// GET all states
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
     FROM state;
  `;
  const states = await db.all(getStatesQuery);
  response.send(states);
});

// GET state based on state ID
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
        FROM state
        WHERE state_id = ${stateId};
    `;
  const state = await db.get(getStateQuery);
  response.send(state);
});

// POST Create District in district table
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO district (
        district_name, state_id, cases, cured, active, deaths
    ) VALUES (
        '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}
    );
  `;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// GET district based on district_id
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT
            district_id AS districtId,
            district_name AS districtName,
            state_id AS stateId,
            cases,
            cured,
            active,
            deaths
        FROM district
        WHERE district_id = ${districtId};
    `;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

// DELETE district based on district_id
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// UPDATE district based on district_id
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district SET 
        district_name = '${districtName}', 
        state_id = ${stateId}, 
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
        WHERE district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsOfStateQuery = `
        SELECT 
        sum(cases) AS totalCases,
        sum(cured) AS totalCured,
        sum(active) AS totalActive,
        sum(deaths) AS totalDeaths
        FROM district 
        WHERE state_id = ${stateId};
        GROUP BY state_id;
    `;
    const stateStats = await db.get(getStatsOfStateQuery);
    response.send(stateStats);
  }
);

module.exports = app;
