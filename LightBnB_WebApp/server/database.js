require('dotenv').config();
const env = process.env;

const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require('pg');

// Database Pool
const pool = new Pool({
  user: env.USER,
  password: env.PASS,
  host: env.HOST, 
  database: env.NAME,
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = email => {
  const queryString = `
  SELECT id,
    name,
    email,
    password
  FROM users
  WHERE email = $1;
  `;

  return pool
    .query(queryString, [email])
    .then((res) => {
      if (!res.rows[0]) {
        throw new Error('Invalid email address');
      }
      return res.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = id => {
  const queryString = `
  SELECT id,
    name,
    email,
    password
  FROM users
  WHERE id = $1;
  `;

  return pool
    .query(queryString, [id])
    .then((res) => {
      if (!res.rows[0]) {
        throw new Error('Invalid user id');
      }
      return res.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
exports.getUserWithId = getUserWithId;

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = user => {
  const queryString = `
  INSERT INTO users(name, password, email)
  VALUES($1, $2, $3)
  RETURNING *;
  `;

  const values = [user.name, user.password, user.email];

  return pool
    .query(queryString, values)
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = (guest_id, limit = 10) => {
  const queryString = `
  SELECT reservations.id AS res_id,
    properties.*,
    reservations.start_date,
    reservations.end_date,
    AVG(rating) AS average_rating
  FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
  WHERE reservations.guest_id = $1
  GROUP BY properties.id,
    reservations.id
  ORDER BY reservations.start_date
  LIMIT $2;
  `;

  const values = [guest_id, limit]

  return pool
    .query(queryString, values)
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = (options, limit = 10) => {
  const queryParams = [];
  let whereAnd = `WHERE`;

  let queryString = `
  SELECT properties.*, AVG(property_reviews.rating) AS average_rating
  FROM properties
    JOIN property_reviews ON properties.id = property_id
  `;

  // When user checks their own properties under 'My Listings'
  if (options.owner_id) {
    queryParams.push(`${options.owner_id}`);
    queryString += `${whereAnd} owner_id = $${queryParams.length} `;
  }

  // Users search options
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `${whereAnd} city LIKE $${queryParams.length} `;
    whereAnd = `AND`;
  }

  if (options.minimum_price_per_night) {
    queryParams.push(`${options.minimum_price_per_night}`);

    queryString += `
    ${whereAnd} cost_per_night / 100 > $${queryParams.length} 
    `;
    whereAnd = `AND`;
  }

  if (options.maximum_price_per_night) {
    queryParams.push(`${options.maximum_price_per_night}`)
    queryString += `
    ${whereAnd} cost_per_night / 100 < $${queryParams.length}
    `;
  }

  queryString += `GROUP BY properties.id `;

  if (options.minimum_rating) {
    queryParams.push(`${options.minimum_rating}`);
    queryString += `
    HAVING AVG(property_reviews.rating) >= $${queryParams.length} `;
  }

  queryParams.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  return pool
    .query(queryString, queryParams)
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};
exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = property => {
  const propertyValues = ['owner_id', 'title', 'description', 'thumbnail_photo_url', 'cover_photo_url', 'cost_per_night', 'street', 'city', 'province', 'post_code', 'country', 'parking_spaces', 'number_of_bathrooms', 'number_of_bedrooms'];

  const queryString = `
  INSERT INTO properties(${propertyValues.join(', ')})
  VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING *;
  `;

  const values = propertyValues.map((value) => property[value]);

  return pool
    .query(queryString, values)
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
exports.addProperty = addProperty;