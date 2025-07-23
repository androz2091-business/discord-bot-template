import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CronJob } from "cron";
import { type Client, Collection } from "discord.js";

export interface TaskData {
	name: string;
	crons: string;
	jobs: CronJob[];
	run(): void;
}

export const loadTasks = async (client: Client) => {
	const tasks = new Collection<string, TaskData>();
	const tasksData: TaskData[] = [];

	try {
		const tasksPath = join(import.meta.dirname, "..", "tasks");
		const files = readdirSync(tasksPath);
		for (const file of files) {
			if (file.endsWith(".js") || (process.versions.bun && file.endsWith('.ts'))) {
				const taskModule = await import(join(tasksPath, file));
				const taskOriginal = taskModule.default || taskModule;

				const task: TaskData = {
					...taskOriginal,
					jobs: [],
				};
				const taskName = file.split(".")[0];

				task.jobs = [];
				taskOriginal.crons.forEach((cron: string) => {
					task.jobs.push(
						new CronJob(
							cron,
							() => {
								task.run();
							},
							null,
							true,
							"America/Los_Angeles",
						),
					);
				});

				tasks.set(taskName, task);
				tasksData.push(task);
				console.log(`Loaded task ${taskName}`);
			}
		}
	} catch (e) {
		console.error(e);
		console.log("No task found");
	}

	return {
		tasks,
		tasksData,
	};
};
