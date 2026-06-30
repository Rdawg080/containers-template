import { Container, getContainer, getRandom } from "@cloudflare/containers";
import { Hono } from "hono";

type AppEnv = Env & {
	REDDIT_CLIENT_ID: string;
	REDDIT_CLIENT_SECRET: string;
	REDDIT_USER_AGENT: string;
};

export class MyContainer extends Container<Env> {
	// Port the container listens on (default: 8080)
	defaultPort = 8080;
	// Time before container sleeps due to inactivity (default: 30s)
	sleepAfter = "2m";
	// Environment variables passed to the container
	envVars = {
		MESSAGE: "I was passed in via the container class!",
	};

	// Optional lifecycle hooks
	override onStart() {
		console.log("Container successfully started");
	}

	override onStop() {
		console.log("Container successfully shut down");
	}

	override onError(error: unknown) {
		console.log("Container error:", error);
	}
}

// Fetch a Reddit OAuth2 access token using client credentials flow
async function getRedditToken(env: AppEnv): Promise<string> {
	const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
	const res = await fetch("https://www.reddit.com/api/v1/access_token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": env.REDDIT_USER_AGENT,
		},
		body: "grant_type=client_credentials",
	});

	if (!res.ok) {
		throw new Error(`Reddit auth failed: ${res.status} ${res.statusText}`);
	}

	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

// Call the Reddit OAuth API with an authenticated token
async function redditFetch(path: string, env: AppEnv): Promise<unknown> {
	const token = await getRedditToken(env);
	const res = await fetch(`https://oauth.reddit.com${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": env.REDDIT_USER_AGENT,
		},
	});

	if (!res.ok) {
		throw new Error(`Reddit API error: ${res.status} ${res.statusText}`);
	}

	return res.json();
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
	Bindings: AppEnv;
}>();

// Home route with available endpoints
app.get("/", (c) => {
	return c.text(
		"Available endpoints:\n" +
			"GET /container/<ID> - Start a container for each ID with a 2m timeout\n" +
			"GET /lb - Load balance requests over multiple containers\n" +
			"GET /error - Start a container that errors (demonstrates error handling)\n" +
			"GET /singleton - Get a single specific container instance\n" +
			"\nReddit endpoints:\n" +
			"GET /reddit - Reddit API info\n" +
			"GET /reddit/:subreddit - Hot posts from a subreddit\n" +
			"GET /reddit/:subreddit/top - Top posts from a subreddit\n" +
			"GET /reddit/:subreddit/comments/:post_id - Comments for a post",
	);
});

// Route requests to a specific container using the container ID
app.get("/container/:id", async (c) => {
	const id = c.req.param("id");
	const containerId = c.env.MY_CONTAINER.idFromName(`/container/${id}`);
	const container = c.env.MY_CONTAINER.get(containerId);
	return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
app.get("/error", async (c) => {
	const container = getContainer(c.env.MY_CONTAINER, "error-test");
	return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
app.get("/lb", async (c) => {
	const container = await getRandom(c.env.MY_CONTAINER, 3);
	return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get("/singleton", async (c) => {
	const container = getContainer(c.env.MY_CONTAINER);
	return await container.fetch(c.req.raw);
});

// Reddit routes

app.get("/reddit", (c) => {
	return c.json({
		endpoints: {
			"GET /reddit/:subreddit": "Hot posts from a subreddit",
			"GET /reddit/:subreddit/top": "Top posts from a subreddit",
			"GET /reddit/:subreddit/comments/:post_id": "Comments for a post",
		},
	});
});

app.get("/reddit/:subreddit", async (c) => {
	const subreddit = c.req.param("subreddit");
	const limit = c.req.query("limit") ?? "25";
	try {
		const data = await redditFetch(`/r/${subreddit}/hot?limit=${limit}`, c.env);
		return c.json(data);
	} catch (err) {
		return c.json({ error: String(err) }, 502);
	}
});

app.get("/reddit/:subreddit/top", async (c) => {
	const subreddit = c.req.param("subreddit");
	const limit = c.req.query("limit") ?? "25";
	const t = c.req.query("t") ?? "day"; // hour, day, week, month, year, all
	try {
		const data = await redditFetch(`/r/${subreddit}/top?limit=${limit}&t=${t}`, c.env);
		return c.json(data);
	} catch (err) {
		return c.json({ error: String(err) }, 502);
	}
});

app.get("/reddit/:subreddit/comments/:post_id", async (c) => {
	const subreddit = c.req.param("subreddit");
	const postId = c.req.param("post_id");
	const limit = c.req.query("limit") ?? "100";
	try {
		const data = await redditFetch(
			`/r/${subreddit}/comments/${postId}?limit=${limit}`,
			c.env,
		);
		return c.json(data);
	} catch (err) {
		return c.json({ error: String(err) }, 502);
	}
});

export default app;
