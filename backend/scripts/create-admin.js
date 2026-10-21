// Creates an administrator (research R10):
//   docker compose exec api node scripts/create-admin.js <username>
// The password is asked interactively, so it never ends up in the shell history.
import readline from 'node:readline'
import { db } from '../src/db/knex.js'
import { hashPassword, passwordProblem } from '../src/lib/password.js'

// One interface whose lines are buffered, so piped input also works (it may arrive before the
// questions are asked). Typed characters are not echoed.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
rl._writeToOutput = () => {}
const bufferedLines = []
const waiting = []
let inputClosed = false
// PowerShell puts a byte order mark before piped input; it is never part of a password.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)
rl.on('line', (raw) => {
  const line = raw.startsWith(BYTE_ORDER_MARK) ? raw.slice(1) : raw
  if (waiting.length) waiting.shift()(line)
  else bufferedLines.push(line)
})
rl.on('close', () => {
  inputClosed = true
  while (waiting.length) waiting.shift()('')
})

function askHidden(prompt) {
  process.stdout.write(prompt)
  return new Promise((resolve) => {
    const answer = (line) => {
      process.stdout.write('\n')
      resolve(line)
    }
    if (bufferedLines.length) answer(bufferedLines.shift())
    else if (inputClosed) answer('')
    else waiting.push(answer)
  })
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exitCode = 1
}

async function main() {
  const username = (process.argv[2] ?? '').trim()
  if (username.length < 3 || username.length > 100) {
    return fail('usage: node scripts/create-admin.js <username> (3 to 100 characters)')
  }
  if (await db('Administrator').where({ username }).first('id')) {
    return fail(`administrator "${username}" already exists`)
  }

  const password = await askHidden('Password (at least 10 characters): ')
  if (passwordProblem(password)) return fail('the password must be 10 to 128 characters long')
  const repeated = await askHidden('Repeat password: ')
  if (repeated !== password) return fail('the passwords do not match')

  await db('Administrator').insert({ username, passwordHash: await hashPassword(password) })
  console.log(`Administrator "${username}" created.`)
}

try {
  await main()
} catch (err) {
  fail(err.message)
} finally {
  rl.close()
  await db.destroy()
}
