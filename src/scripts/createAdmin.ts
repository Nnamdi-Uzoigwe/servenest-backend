import readline from "readline";
import { connectDB, disconnectDB } from "@/config/db";
import { User } from "@/modules/users/user.model";
import { hashPassword } from "@/utils/password";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (!muted) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    // The prompt is already written, so everything typed after this is hidden
    if (hidden) muted = true;
  });
}

async function main() {
  const fullName = await ask("Full name: ");
  const email = (await ask("Email: ")).toLowerCase();
  const roleInput = (await ask("Role (admin or dispatcher) [admin]: ")) || "admin";
  const password = await ask("Password: ", true);
  const confirm = await ask("Confirm password: ", true);

  if (fullName.length < 2) throw new Error("Full name is too short");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email address");
  if (roleInput !== "admin" && roleInput !== "dispatcher") {
    throw new Error("Role must be admin or dispatcher");
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Password needs 8+ characters with at least a letter and a number");
  }
  if (password !== confirm) throw new Error("Passwords do not match");

  await connectDB();

  if (await User.exists({ email })) {
    throw new Error(`An account with ${email} already exists`);
  }

  const user = await User.create({
    fullName,
    email,
    passwordHash: await hashPassword(password),
    role: roleInput,
    isEmailVerified: true,
  });

  console.log(`\nCreated ${roleInput}: ${user.email} (id ${user._id})`);
}

main()
  .catch((err) => {
    console.error(`\nFailed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });