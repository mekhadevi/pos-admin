const db = require('../db');
const bcrypt = require('bcrypt');

function initialize() {
  // Company
  const company = db.prepare(`SELECT * FROM CompanyMaster WHERE Id = 1`).get();

  if (!company) {
    db.prepare(
      `
      INSERT INTO CompanyMaster (Id, Name)
      VALUES (1, 'My Company')
    `,
    ).run();
  }

  // Branch
  const branch = db.prepare(`SELECT * FROM BranchMaster WHERE Id = 1`).get();

  if (!branch) {
    db.prepare(
      `
      INSERT INTO BranchMaster (Id, CompanyId, Name)
      VALUES (1, 1, 'Main Branch')
    `,
    ).run();
  }

  createUser();
}

// Create user (for testing)
function createUser() {
  const existing = db.prepare(`SELECT * FROM UsersMaster WHERE Username = ?`).get('admin');

  if (existing) {
    console.log('Admin already exists');
    return;
  }

  const password = '1234';
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `
    INSERT INTO UsersMaster 
    (CompanyId, Name, Username, PasswordHash, Role)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(1, 'Admin User', 'admin', hash, 'Admin');

  console.log('User created: admin / 1234');
}

// Login
function login(data) {
  const user = db.prepare(`SELECT * FROM UsersMaster WHERE Username = ?`).get(data.username);

  if (!user) return { success: false, message: 'User not found' };

  const isMatch = bcrypt.compareSync(data.password, user.PasswordHash);
  if (!isMatch) return { success: false, message: 'Wrong password' };

  const company = db.prepare(`SELECT * FROM CompanyMaster WHERE Id = ?`).get(user.CompanyId);
  const branch = db.prepare(`SELECT * FROM BranchMaster WHERE CompanyId = ?`).get(user.CompanyId);

  return {
    success: true,
    user: {
      id: user.Id,
      name: user.Name,
      role: user.Role,
    },
    company: {
      id: company.Id,
      name: company.Name,
    },
    branch: {
      id: branch.Id,
      name: branch.Name,
    },
  };
}

module.exports = { login, createUser, initialize };
