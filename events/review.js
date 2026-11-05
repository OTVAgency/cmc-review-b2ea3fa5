"use strict";

// The production records are a deliberate client snapshot. Media and revision
// notes stay in Drive and Jotform rather than depending on Cory's local server.
const data = window.CMC_DATA;
const $ = (id) => document.getElementById(id);
let project;
let selected;
let feedbackOpener;
let previewTimer;

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function clock(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

function chooseAsset(id, focus = false) {
  selected = project.assets.find((asset) => asset.id === id) || project.assets[0];
  $("asset-title").textContent = selected.title;
  $("asset-detail").textContent = selected.detail;
  $("asset-kind").textContent = selected.supplementary ? "Extra · Reference" : selected.kind === "photo" ? "Photo candidate" : "Video review";
  // Use Drive's embedded viewer, retaining the file's existing account access.
  // Replacing the frame stops the previous video when the selection changes.
  clearTimeout(previewTimer);
  const frame = element("iframe");
  frame.id = "media-preview";
  frame.title = selected.title + " · Google Drive preview";
  frame.allow = "autoplay; fullscreen";
  frame.allowFullscreen = true;
  frame.src = "https://drive.google.com/file/d/" + encodeURIComponent(selected.driveId) + "/preview";
  $("preview-status").textContent = "Loading the selected preview…";
  frame.addEventListener("load", () => {
    clearTimeout(previewTimer);
    // Cross-origin load does not prove successful playback or account access.
    $("preview-status").textContent = selected.kind === "photo"
      ? "Review the photo above. Include its frame number in your feedback."
      : "Press Play above to review. Add the timestamp when leaving feedback.";
  });
  $("player").replaceChildren(frame);
  previewTimer = setTimeout(() => {
    $("preview-status").textContent = "Preview taking a while? Open in Drive below to sign in or check video processing.";
  }, 15000);
  $("open-media").href = selected.url;
  $("open-media").setAttribute("aria-label", "Open " + selected.title + " in Google Drive");
  document.querySelectorAll(".media-choice").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.asset === selected.id));
  });
  if (selected.supplementary && !project.scope) document.querySelector(".extra-media").open = true;
  const url = new URL(location.href);
  url.hash = project.id;
  url.searchParams.set("item", selected.id);
  history.replaceState(null, "", url);
  if (focus) $("player").scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderLibrary() {
  $("media-list").replaceChildren();
  $("extras-list").replaceChildren();
  $("extras-section").hidden = !project.scope;
  const mainCount = project.assets.filter((asset) => !asset.supplementary).length;
  $("asset-count").textContent = "(" + mainCount + ")";
  const mainGroups = [...new Set(project.assets.filter((asset) => !asset.supplementary).map((asset) => asset.group))];
  const extraGroups = [...new Set(project.assets.filter((asset) => asset.supplementary).map((asset) => asset.group))];
  const groups = project.scope ? mainGroups : [...mainGroups, ...extraGroups];
  for (const name of groups) {
    const supplementary = project.assets.filter((item) => item.group === name).every((item) => item.supplementary);
    const group = element(supplementary ? "details" : "section", undefined, supplementary ? "media-group extra-media" : "media-group");
    group.append(element(supplementary ? "summary" : "h3", supplementary ? name + " (" + project.assets.filter((item) => item.group === name).length + ")" : name));
    for (const asset of project.assets.filter((item) => item.group === name)) {
      const button = element("button", undefined, "media-choice");
      button.type = "button";
      button.dataset.asset = asset.id;
      button.setAttribute("aria-pressed", "false");
      button.append(element("strong", asset.title), element("small", asset.detail));
      if (asset.shortlisted) button.append(element("span", "★ Editorial shortlist", "shortlist"));
      button.addEventListener("click", () => chooseAsset(asset.id, true));
      group.append(button);
    }
    $("media-list").append(group);
  }
  if (project.scope) {
    for (const asset of project.assets.filter((item) => item.supplementary)) {
      const button = element("button", undefined, "media-choice");
      button.type = "button";
      button.dataset.asset = asset.id;
      button.append(element("strong", asset.title), element("small", asset.detail));
      button.addEventListener("click", () => chooseAsset(asset.id, true));
      $("extras-list").append(button);
    }
    if (!mainCount) $("media-list").append(element("p", "The requested edits will appear here when ready. Existing reference cuts are in Extras below.", "library-empty"));
  }
}

function renderProject() {
  const identity = location.hash.slice(1);
  project = data.projects.find((item) => item.id === identity) || data.projects[0];
  document.title = project.title + " · CMC media review";
  $("event-title").textContent = project.title;
  $("event-subtitle").textContent = project.subtitle;
  $("event-description").textContent = project.description;
  $("event-status").textContent = project.status;
  $("review-hint").textContent = project.reviewHint;
  renderScope();
  document.querySelectorAll(".nav-item").forEach((link) => {
    if (link.hash === "#" + project.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("deliverable-list").replaceChildren();
  for (const item of project.deliverables) {
    const card = element("article", undefined, "deliverable");
    card.append(element("h3", item.title), element("span", item.status, "status"), element("p", item.detail));
    $("deliverable-list").append(card);
  }
  $("credits-section").hidden = !project.credits;
  $("youtube-package").hidden = !project.youtube;
  if (project.youtube) {
    const yt = project.youtube;
    $("youtube-thumbnail").src = yt.thumbnail;
    $("youtube-thumbnail").alt = yt.thumbnailAlt;
    $("thumbnail-open").href = yt.thumbnail;
    $("thumbnail-download").href = yt.thumbnail;
    $("youtube-title").value = yt.title;
    $("youtube-description").value = yt.description;
    $("description-download").href = yt.descriptionFile;
    $("copy-status").textContent = "";
  }
  $("credits-list").replaceChildren();
  for (const item of project.credits || []) {
    const card = element("div", undefined, "credit");
    card.append(element("time", clock(item.start)), element("strong", item.name), element("span", [item.role, item.organization].filter(Boolean).join(" · ")));
    $("credits-list").append(card);
  }
  renderLibrary();
  const wanted = new URL(location.href).searchParams.get("item");
  chooseAsset(project.assets.some((asset) => asset.id === wanted) ? wanted : project.defaultAsset);
}

function renderScope() {
  $("scope-section").hidden = !project.scope;
  $("deliverables-section").hidden = Boolean(project.scope);
  $("scope-list").replaceChildren();
  if (!project.scope) return;
  $("scope-source").textContent = "Requested " + project.scope.requested + " · Due " + project.scope.due;
  const complete = project.scope.items.filter((item) => item.complete).length;
  $("scope-progress").textContent = complete + " of " + project.scope.items.length + " complete";
  for (const item of project.scope.items) {
    const row = element("li", undefined, "scope-item");
    const mark = element("span", item.complete ? "✓" : "○", "scope-mark");
    mark.setAttribute("aria-label", item.complete ? "Complete" : "Not yet complete");
    const copy = element("div", undefined, "scope-copy");
    copy.append(element("h3", item.title), element("p", item.criteria), element("small", item.detail));
    const actions = element("div", undefined, "scope-actions");
    actions.append(element("span", item.status, "status"));
    if (item.asset) {
      const review = element("button", item.action, "text-button");
      review.type = "button";
      review.addEventListener("click", () => chooseAsset(item.asset, true));
      actions.append(review);
    }
    const note = element("button", "Leave feedback →", "text-button");
    note.type = "button";
    note.addEventListener("click", (event) => feedback({title: item.title, detail: item.criteria, kind: "scope"}, event.currentTarget));
    actions.append(note);
    row.append(mark, copy, actions);
    $("scope-list").append(row);
  }
}

function feedback(item, opener) {
  // These unique field names were verified on the actual Jotform form.
  const url = new URL(data.form);
  url.searchParams.set("q2_dropdown0", project.formEvent);
  url.searchParams.set("q3_textbox1", item ? item.title + " — " + item.detail : "General event feedback");
  if (item?.kind === "photo") url.searchParams.set("q5_textbox3", item.title);
  url.searchParams.set("q7_dropdown5", "Revision request");
  $("feedback-context").textContent = project.title + (item ? " / " + item.title : " / General feedback");
  $("feedback-external").href = url.href;
  $("revision-form").reset();
  $("feedback-event").value = project.formEvent;
  $("feedback-item").value = item ? item.title + " — " + item.detail : "General event feedback";
  $("feedback-time").value = item?.kind === "photo" ? item.title : "";
  $("submission-help").textContent = "One note per requested change. Your review page stays open.";
  feedbackOpener = opener;
  $("feedback-dialog").showModal();
}

async function copyYouTube(field) {
  const input = $("youtube-" + field);
  try {
    await navigator.clipboard.writeText(input.value);
    $("copy-status").textContent = field === "title" ? "Title copied." : "Description copied.";
  } catch {
    // Keep the text selectable when a browser blocks clipboard access.
    input.focus();
    input.select();
    $("copy-status").textContent = "Text selected. Use your device’s Copy command.";
  }
}

for (const field of ["title", "description"]) {
  $("copy-" + field).addEventListener("click", () => copyYouTube(field));
  $(field + "-feedback").addEventListener("click", (event) => feedback({
    title: "YouTube " + field,
    detail: "Comfy Connections recap · Draft v" + project.youtube.version,
    kind: "copy"
  }, event.currentTarget));
}
$("thumbnail-feedback").addEventListener("click", (event) => feedback({
  title: "YouTube thumbnail",
  detail: "Comfy Connections recap · Draft v" + project.youtube.version,
  kind: "graphic"
}, event.currentTarget));

for (const item of data.projects) {
  const link = element("a", undefined, "nav-item");
  link.href = "#" + item.id;
  link.append(element("span", item.number, "number"), element("span", item.title));
  $("project-nav").append(link);
}
$("updated").textContent = "Updated " + data.updated;
// The skip link moves focus without changing the selected event route.
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  $("project").focus();
  $("project").scrollIntoView({ block: "start" });
});
$("feedback-current").addEventListener("click", (event) => feedback(selected, event.currentTarget));
$("feedback-general").addEventListener("click", (event) => feedback(null, event.currentTarget));
$("close-feedback").addEventListener("click", () => $("feedback-dialog").close());
$("revision-form").addEventListener("submit", () => {
  // Only Jotform's receipt confirms durable storage. Do not claim success based
  // on a click or save a private revision in the publicly hosted repository.
  $("submission-help").textContent = "Check the new Jotform tab for your saved-feedback receipt. If it did not open, use the full feedback form below.";
});
$("feedback-dialog").addEventListener("close", () => {
  feedbackOpener?.focus();
});
window.addEventListener("hashchange", renderProject);
renderProject();
