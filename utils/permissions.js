const config = require('../config.json');

function isAdmin(member) {
  return (
    member.roles.cache.has(config.adminRoleId) ||
    member.roles.cache.has(config.teamRoleId) ||
    member.permissions.has('Administrator')
  );
}

module.exports = { isAdmin };
