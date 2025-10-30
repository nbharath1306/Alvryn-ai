// Passport was removed from the project in favor of server-side OAuth flows.
// Keep a tiny compatibility shim so older tests that require this module
// don't crash during the transition.

function setup() {
  // no-op
}

const passport = {}; // empty placeholder

module.exports = { setup, passport };
