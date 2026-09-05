const { spawn } = require('child_process');

function startProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options
  });

  child.on('exit', code => {
    console.error(`${name} stopped with code ${code}.`);
    process.exit(code || 1);
  });

  child.on('error', error => {
    console.error(`Could not start ${name}:`, error);
    process.exit(1);
  });

  return child;
}

const bot = startProcess('Badge bot', 'node', ['index.js']);

const website = startProcess(
  'Dashboard',
  'node',
  ['server.js'],
  { cwd: './web' }
);

function shutDown() {
  bot.kill();
  website.kill();
  process.exit(0);
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);