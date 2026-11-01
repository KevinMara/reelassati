import type { WorkspaceDocument } from "@contracts/workspace";
import { isInProgressWindow, progressWindow } from "./workspace-progress";

export interface WeeklyAction {
  key: string;
  title: string;
  evidence: string;
  values?: Record<string, string | number>;
  to: string;
  cta: string;
}

export function buildWeeklyReview(
  workspace: WorkspaceDocument,
  now = new Date()
) {
  const window = progressWindow(now);
  const projectsTouched = workspace.projects.filter(project =>
    isInProgressWindow(project.updatedAt, window)
  );
  const postsCreated = workspace.posts.filter(post =>
    isInProgressWindow(post.createdAt, window)
  );
  const postsPublished = workspace.posts.filter(
    post =>
      post.status === "published" &&
      isInProgressWindow(post.publishedAt, window)
  );
  const scheduledPosts = workspace.posts.filter(
    post =>
      post.status === "scheduled" &&
      Date.parse(post.scheduledAt || "") > window.end
  );
  const failedPosts = workspace.posts.filter(post => post.status === "failed");
  const draftPosts = workspace.posts.filter(post => post.status === "draft");
  const openProjects = workspace.projects.filter(project =>
    ["draft", "editing", "review"].includes(project.status)
  );
  const readyAssets = workspace.assets.filter(
    asset => asset.status === "ready" && ["image", "video"].includes(asset.kind)
  );
  const connectedAccounts = workspace.accounts.filter(
    account => account.status === "connected"
  );
  const expiredAccounts = workspace.accounts.filter(
    account => account.status === "expired"
  );
  const activeGoals = workspace.goals.filter(
    goal =>
      Number.isFinite(goal.target) &&
      goal.target > 0 &&
      Number.isFinite(goal.current) &&
      goal.current >= 0 &&
      goal.current < goal.target
  );
  const actions: WeeklyAction[] = [];

  if (failedPosts.length) {
    actions.push({
      key: "failed",
      title: "Resolve a failed publication",
      evidence:
        "Failed publication records: {{count}}. Review the destination and media before retrying.",
      values: { count: failedPosts.length },
      to: `/dashboard/publish?draft=${encodeURIComponent(failedPosts[0].id)}`,
      cta: "Review publication",
    });
  }
  if (expiredAccounts.length || !connectedAccounts.length) {
    actions.push({
      key: "connection",
      title: expiredAccounts.length
        ? "Reconnect a publishing destination"
        : "Connect your publishing destination",
      evidence: expiredAccounts.length
        ? "Expired connections: {{count}}. Check these before your next publication."
        : "No connected destinations. Connect an account when you are ready to publish.",
      values: { count: expiredAccounts.length },
      to: "/dashboard/social",
      cta: "Open Social Hub",
    });
  }
  if (openProjects.length) {
    const project = [...openProjects].sort(
      (a, b) =>
        Number(b.status === "review") - Number(a.status === "review") ||
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
    )[0];
    actions.push({
      key: "edit",
      title: "Finish an open edit",
      evidence:
        "“{{title}}” is still open. Review the timeline and export when it is ready.",
      values: { title: project.title },
      to: `/dashboard/edit?project=${encodeURIComponent(project.id)}`,
      cta: "Continue this edit",
    });
  } else if (!workspace.projects.length) {
    actions.push({
      key: "start",
      title: "Start your first edit",
      evidence:
        "No editing projects yet. Bring in footage and set the intended platform.",
      to: "/dashboard/edit",
      cta: "Open editing studio",
    });
  }
  if (draftPosts.length) {
    actions.push({
      key: "draft",
      title: "Review a publication draft",
      evidence:
        "Saved drafts: {{count}}. Check the caption and media, then decide when to publish.",
      values: { count: draftPosts.length },
      to: `/dashboard/publish?draft=${encodeURIComponent(draftPosts[0].id)}`,
      cta: "Open draft",
    });
  } else if (
    connectedAccounts.length &&
    readyAssets.length &&
    !postsPublished.length &&
    !scheduledPosts.length
  ) {
    actions.push({
      key: "publish",
      title: "Prepare your next publication",
      evidence:
        "No dated publications this week or upcoming scheduled posts. Choose a ready asset to review.",
      to: `/dashboard/publish?asset=${encodeURIComponent(readyAssets[0].id)}`,
      cta: "Review ready media",
    });
  }
  if (activeGoals.length) {
    const goal = [...activeGoals].sort(
      (a, b) => b.current / b.target - a.current / a.target
    )[0];
    actions.push({
      key: "goal",
      title: "Review your next goal",
      evidence:
        "“{{goal}}” is at {{percent}}% of its saved target. Update it with a verified result.",
      values: {
        goal: goal.label,
        percent: Math.floor((goal.current / goal.target) * 100),
      },
      to: "/dashboard/goals",
      cta: "Review goals",
    });
  }
  if (!actions.length) {
    actions.push({
      key: "plan",
      title: "Plan the next piece",
      evidence:
        "No open edits or publication drafts need attention. Add the next content task to your calendar.",
      to: "/dashboard/calendar",
      cta: "Open calendar",
    });
  }
  return {
    projectsTouched: projectsTouched.length,
    postsCreated: postsCreated.length,
    postsPublished: postsPublished.length,
    scheduledPosts: scheduledPosts.length,
    activeGoals: activeGoals.length,
    connectedAccounts: connectedAccounts.length,
    actions: actions.slice(0, 4),
  };
}
