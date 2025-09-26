
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Inscription (signup)
export async function POST(request) {
	const { username, email, password } = await request.json();
	if (!username || !email || !password) {
		return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
	}
	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return new Response(JSON.stringify({ error: "Email déjà utilisé" }), { status: 409 });
	}
	const hashed = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: { username, email, password: hashed },
	});
	return new Response(JSON.stringify({ user: { id: user.id, username: user.username, email: user.email } }), { status: 201 });
}

// Connexion (signin)
export async function GET(request) {
	const { email, password } = Object.fromEntries(new URL(request.url).searchParams);
	if (!email || !password) {
		return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
	}
	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || !(await bcrypt.compare(password, user.password))) {
		return new Response(JSON.stringify({ error: "Identifiants invalides" }), { status: 401 });
	}
	// Ici, retournez un token ou la session selon votre logique
	return new Response(JSON.stringify({ user: { id: user.id, username: user.username, email: user.email } }), { status: 200 });
}