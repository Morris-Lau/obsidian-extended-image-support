export default {
  readFileSync: () => { throw new Error('fs.readFileSync not available in browser'); },
  writeFileSync: () => { throw new Error('fs.writeFileSync not available in browser'); },
  existsSync: () => false,
  mkdirSync: () => { throw new Error('fs.mkdirSync not available in browser'); },
  readdirSync: () => [],
};
