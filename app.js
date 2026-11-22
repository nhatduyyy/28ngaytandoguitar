/* 28 Ngay Tan Do Guitar — HTML/CSS/JS, Supabase + local demo.
   Public data is readable. Admins edit videos; approved reviewer accounts mark recording status (RLS + restricted RPC). */
(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const el = (id) => document.getElementById(id);
  const state = {
    mode: "demo", client: null, entries: [], admin: false, reviewer: false, statusBusyIds: new Set(),
    filter: "all", term: "", editingId: null, deletingId: null,
    busy: false, requestNumber: 0
  };
  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-6 4v7m4-7v7"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
  };
  let toastTimer;

  function toast(message, isError = false) {
    const target = el("toast");
    target.textContent = message;
    target.classList.toggle("error", !!isError);
    target.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => target.classList.remove("visible"), 3400);
  }

  function setBadge(kind, message) {
    const node = el("connectionBadge");
    node.classList.remove("demo", "error");
    if (kind !== "live") node.classList.add(kind === "demo" ? "demo" : "error");
    el("connectionText").textContent = message;
  }

  function setError(message = "") {
    const target = el("errorAlert");
    target.hidden = !message;
    target.textContent = message;
  }

  function storageGet() {
    try {
      const list = JSON.parse(localStorage.getItem("guitar28-video-demo") || "[]");
      return Array.isArray(list) ? list.filter(item => item && typeof item.title === "string") : [];
    } catch { return []; }
  }

  function storageSet() {
    try {
      localStorage.setItem("guitar28-video-demo", JSON.stringify(state.entries));
    } catch {
      toast("Không thể lưu dữ liệu bản xem thử trên trình duyệt này.", true);
    }
  }

  function newId() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const ordered = () => [...state.entries].sort((a, b) =>
    (Number(a.position) || 0) - (Number(b.position) || 0) ||
    String(a.created_at || "").localeCompare(String(b.created_at || ""))
  );

  function makeButton(action, id, title, icon, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `small-icon-button ${action === "delete" ? "delete" : ""}`;
    button.dataset.action = action;
    button.dataset.id = String(id);
    button.innerHTML = icon;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.disabled = disabled;
    return button;
  }

  function dateLabel(value) {
    if (!value) return "Đã thêm vào thư viện";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "Đã thêm vào thư viện";
    return `Cập nhật ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)}`;
  }

  function getHostname(value) {
    try { return new URL(value).hostname.replace(/^www\./, ""); }
    catch { return "Video"; }
  }

  function filteredEntries() {
    return ordered().filter(item => {
      const hasUrl = !!String(item.url || "").trim();
      if (state.filter === "linked" && !hasUrl) return false;
      if (state.filter === "unlinked" && hasUrl) return false;
      if (state.filter === "filmed" && !item.is_filmed) return false;
      if (state.filter === "unfilmed" && !!item.is_filmed) return false;
      if (!state.term) return true;
      return `${item.title || ""} ${item.url || ""}`.toLocaleLowerCase("vi-VN").includes(state.term);
    });
  }

  function render() {
    const count = state.entries.length;
    const linked = state.entries.filter(item => !!String(item.url || "").trim()).length;
    el("totalCount").textContent = count.toLocaleString("vi-VN");
    el("videoCount").textContent = linked.toLocaleString("vi-VN");
    el("filmedCount").textContent = state.entries.filter(item => !!item.is_filmed).length.toLocaleString("vi-VN");
    el("filterAllCount").textContent = String(count);

    const tbody = el("videoTableBody");
    tbody.replaceChildren();
    const rows = filteredEntries();
    const all = ordered();
    for (const item of rows) {
      const tr = document.createElement("tr");
      const tdIndex = document.createElement("td");
      const index = document.createElement("span");
      index.className = "index-number";
      index.textContent = String(all.findIndex(entry => entry.id === item.id) + 1).padStart(2, "0");
      tdIndex.append(index);
      tr.append(tdIndex);

      const tdTitle = document.createElement("td");
      const title = document.createElement("div");
      title.className = "video-title";
      title.textContent = item.title;
      const sub = document.createElement("div");
      sub.className = "video-sub";
      sub.textContent = dateLabel(item.updated_at || item.created_at);
      tdTitle.append(title, sub);
      tr.append(tdTitle);

      const tdUrl = document.createElement("td");
      if (item.url) {
        const group = document.createElement("div");
        group.className = "link-stack";
        const play = document.createElement("button");
        play.type = "button";
        play.className = "video-link-button";
        play.dataset.action = "play";
        play.dataset.id = String(item.id);
        play.innerHTML = ICONS.play + "<span>Xem video</span>";
        const link = document.createElement("a");
        link.className = "video-url";
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.url.replace(/^https?:\/\//i, "");
        link.title = item.url;
        group.append(play, link);
        tdUrl.append(group);
      } else {
        const pending = document.createElement("span");
        pending.className = "no-link";
        pending.textContent = "Chưa gắn link video";
        tdUrl.append(pending);
      }
      tr.append(tdUrl);

      // Only an authenticated admin/reviewer may change recording progress in live mode.
      // Demo mode permits local checkmarks for quick interface preview.
      const canMark = state.mode === "demo" || state.admin || state.reviewer;
      const tdFilmed = document.createElement("td");
      tdFilmed.className = "filming-cell";
      const statusLabel = document.createElement("label");
      statusLabel.className = `filming-toggle ${item.is_filmed ? "is-filmed" : "is-unfilmed"}`;
      if (!canMark) statusLabel.classList.add("is-readonly");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "filming-checkbox";
      checkbox.checked = !!item.is_filmed;
      checkbox.dataset.id = String(item.id);
      checkbox.disabled = !canMark || state.statusBusyIds.has(String(item.id));
      checkbox.setAttribute("aria-label", `Đánh dấu ${item.title} ${item.is_filmed ? "chưa quay" : "đã quay"}`);
      const statusText = document.createElement("span");
      statusText.className = "filming-toggle-text";
      statusText.textContent = item.is_filmed ? "Đã quay" : "Chưa quay";
      statusLabel.append(checkbox, statusText);
      tdFilmed.append(statusLabel);
      tr.append(tdFilmed);

      if (state.admin) {
        const tdManage = document.createElement("td");
        tdManage.className = "manage-cell";
        const actions = document.createElement("div");
        actions.className = "manage-buttons";
        const pos = all.findIndex(entry => entry.id === item.id);
        actions.append(
          makeButton("up", item.id, "Chuyển lên trên", ICONS.up, pos === 0 || state.busy),
          makeButton("down", item.id, "Chuyển xuống dưới", ICONS.down, pos === all.length - 1 || state.busy),
          makeButton("edit", item.id, "Sửa nội dung", ICONS.edit, state.busy),
          makeButton("delete", item.id, "Xóa nội dung", ICONS.trash, state.busy)
        );
        tdManage.append(actions);
        tr.append(tdManage);
      }
      tbody.append(tr);
    }

    const isEmpty = rows.length === 0;
    el("emptyState").hidden = !isEmpty;
    if (isEmpty) {
      const hasAny = count !== 0;
      el("emptyTitle").textContent = hasAny ? "Không tìm thấy nội dung phù hợp" : "Thư viện đang chờ video đầu tiên";
      el("emptyDescription").textContent = hasAny
        ? "Bạn hãy thử từ khóa khác hoặc chọn lại bộ lọc."
        : "Bắt đầu thêm tên bài học và đường dẫn video để xây dựng thư viện cho cộng đồng.";
      el("emptyAddButton").hidden = !state.admin || hasAny;
    }
    el("tableSummary").textContent = `Hiển thị ${rows.length} / ${count} nội dung`;
  }

  function updateAdminUI() {
    const label = state.admin ? "Thoát quản trị" : state.reviewer ? "Thoát tài khoản sếp" : state.mode === "demo" ? "Chỉnh sửa bản thử" : "Đăng nhập";
    el("adminButtonText").textContent = label;
    el("addButton").hidden = !state.admin;
    el("manageHeader").hidden = !state.admin;
    el("roleHint").textContent = state.mode === "demo"
      ? "Bản xem thử: bạn có thể tích Đã quay / Chưa quay; dữ liệu chỉ được lưu trên trình duyệt này."
      : state.admin
        ? "Bạn có quyền quản trị: thêm, sửa, xóa video và đánh dấu trạng thái quay."
        : state.reviewer
          ? "Tài khoản sếp: tích vào ô để đánh dấu Đã quay, bỏ tích để chuyển về Chưa quay. Thay đổi sẽ tự đồng bộ cho mọi người."
          : "Sếp đăng nhập tài khoản được cấp quyền để tích Đã quay / Chưa quay. Người xem khác vẫn thấy trạng thái nhưng không thể chỉnh sửa.";
    render();
  }

  async function loadEntries(silent = false) {
    if (state.mode !== "live") return;
    const ticket = ++state.requestNumber;
    const { data, error } = await state.client.from("video_items")
      .select("id,title,url,is_filmed,position,created_at,updated_at")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (ticket !== state.requestNumber) return;
    if (error) {
      setBadge("error", "Lỗi đồng bộ");
      setError("Không thể tải danh sách video. Hãy kiểm tra cấu hình Supabase, quyền SELECT của bảng video_items và kết nối mạng. Chi tiết: " + error.message);
      if (!silent) toast("Không tải được thư viện.", true);
      return;
    }
    state.entries = data || [];
    setBadge("live", "Đã kết nối");
    setError("");
    render();
  }

  async function isAllowedAdmin(email) {
    if (!email) return false;
    const { data, error } = await state.client.from("video_admins")
      .select("email").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (error) {
      console.warn("Lỗi kiểm tra quyền quản trị:", error.message);
      return false;
    }
    return !!data;
  }

  async function isAllowedReviewer(email) {
    if (!email) return false;
    const { data, error } = await state.client.from("video_reviewers")
      .select("email").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (error) {
      console.warn("Lỗi kiểm tra quyền duyệt trạng thái:", error.message);
      return false;
    }
    return !!data;
  }

  async function updateFilmingStatus(id, checked) {
    const canMark = state.mode === "demo" || state.admin || state.reviewer;
    const key = String(id);
    if (!canMark || state.statusBusyIds.has(key)) return;
    const item = state.entries.find(entry => String(entry.id) === key);
    if (!item) return;
    state.statusBusyIds.add(key);
    const previous = !!item.is_filmed;
    item.is_filmed = checked;
    render();
    try {
      if (state.mode === "live") {
        if (state.admin) {
          const { data, error } = await state.client.from("video_items")
            .update({ is_filmed: checked, updated_at: new Date().toISOString() })
            .eq("id", id).select("id").single();
          if (error) throw error;
          if (!data) throw new Error("Không tìm thấy nội dung cần cập nhật.");
        } else {
          // Reviewer can ONLY change this Boolean via a permission-checked SQL function.
          const { data, error } = await state.client.rpc("set_video_filming_status", {
            p_item_id: id, p_is_filmed: checked
          });
          if (error) throw error;
          if (!data) throw new Error("Không tìm thấy nội dung cần cập nhật.");
        }
        await loadEntries(true);
      } else {
        item.updated_at = new Date().toISOString();
        storageSet();
      }
      toast(checked ? "Đã đánh dấu: Đã quay." : "Đã chuyển về: Chưa quay.");
    } catch (error) {
      item.is_filmed = previous;
      toast("Không thể cập nhật trạng thái: " + (error.message || "Lỗi chưa xác định"), true);
      if (state.mode === "live") await loadEntries(true);
    } finally {
      state.statusBusyIds.delete(key);
      render();
    }
  }

  async function init() {
    el("currentYear").textContent = String(new Date().getFullYear());
    attachEvents();
    const url = String(cfg.SUPABASE_URL || "").trim();
    const key = String(cfg.SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) {
      state.mode = "demo";
      state.entries = storageGet();
      el("demoAlert").hidden = false;
      el("updateHint").textContent = "Lưu tại trình duyệt này · Chưa đồng bộ";
      setBadge("demo", "Bản xem thử");
      updateAdminUI();
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      state.mode = "error";
      setBadge("error", "Không thể kết nối");
      setError("Thư viện Supabase không tải được. Hãy kiểm tra Internet hoặc cấu hình file config.js.");
      updateAdminUI();
      return;
    }
    try {
      state.mode = "live";
      state.client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      el("updateHint").textContent = "Đồng bộ trực tiếp · Tự kiểm tra mỗi 20 giây";
      await loadEntries();
      const { data: { session }, error } = await state.client.auth.getSession();
      if (!error && session?.user?.email) {
        state.admin = await isAllowedAdmin(session.user.email);
        state.reviewer = !state.admin && await isAllowedReviewer(session.user.email);
      }
      updateAdminUI();
      // Realtime for readers and admins; polling is a fallback in restrictive networks.
      state.client.channel("public-video-library")
        .on("postgres_changes", { event: "*", schema: "public", table: "video_items" }, () => { void loadEntries(true); })
        .subscribe();
      const interval = Math.max(10000, Number(cfg.POLL_INTERVAL_MS) || 20000);
      setInterval(() => { if (!document.hidden) void loadEntries(true); }, interval);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void loadEntries(true);
      });
    } catch (error) {
      state.mode = "error";
      setBadge("error", "Không thể kết nối");
      setError("Khởi tạo kết nối thất bại: " + error.message);
      updateAdminUI();
    }
  }

  function openDialog(id) { const dialog = el(id); if (!dialog.open) dialog.showModal(); }
  function closeDialog(id) {
    const dialog = el(id);
    if (dialog.open) dialog.close();
    if (id === "playerDialog") el("playerContainer").replaceChildren();
  }

  function showEditor(item = null) {
    if (!state.admin) return;
    state.editingId = item?.id ?? null;
    el("editTitle").textContent = item ? "Chỉnh sửa nội dung" : "Thêm nội dung mới";
    el("contentTitle").value = item?.title || "";
    el("contentUrl").value = item?.url || "";
    el("saveButton").textContent = item ? "Lưu thay đổi" : "Thêm vào thư viện";
    openDialog("editDialog");
    el("contentTitle").focus();
  }

  function validateUrl(value) {
    const raw = value.trim();
    if (!raw) return "";
    const url = new URL(raw);
    if (!(["https:", "http:"].includes(url.protocol))) throw new Error("Chỉ chấp nhận link bắt đầu bằng https:// hoặc http://.");
    return url.href;
  }

  async function saveEntry(event) {
    event.preventDefault();
    if (!state.admin || state.busy) return;
    const title = el("contentTitle").value.trim();
    if (!title) return toast("Vui lòng nhập tên nội dung.", true);
    let url;
    try { url = validateUrl(el("contentUrl").value); }
    catch { return toast("Link video không hợp lệ. Ví dụ: https://youtu.be/...", true); }
    state.busy = true;
    el("saveButton").disabled = true;
    const now = new Date().toISOString();
    try {
      const current = state.entries.find(i => i.id === state.editingId);
      if (state.mode === "live") {
        let result;
        if (current) {
          result = await state.client.from("video_items")
            .update({ title, url, updated_at: now }).eq("id", current.id).select("id").single();
        } else {
          const maxPos = state.entries.reduce((max, i) => Math.max(max, Number(i.position) || 0), 0);
          result = await state.client.from("video_items")
            .insert({ title, url, position: maxPos + 1, updated_at: now }).select("id").single();
        }
        if (result.error) throw result.error;
        await loadEntries(true);
      } else {
        if (current) {
          Object.assign(current, { title, url, updated_at: now });
        } else {
          state.entries.push({ id: newId(), title, url, is_filmed: false,
            position: state.entries.reduce((max, i) => Math.max(max, Number(i.position) || 0), 0) + 1,
            created_at: now, updated_at: now });
        }
        storageSet();
        render();
      }
      closeDialog("editDialog");
      toast(current ? "Đã cập nhật nội dung thành công." : "Đã thêm nội dung mới thành công.");
    } catch (error) {
      toast("Không thể lưu nội dung: " + (error.message || "Lỗi chưa xác định"), true);
    } finally {
      state.busy = false;
      el("saveButton").disabled = false;
    }
  }

  function askDelete(item) {
    if (!state.admin) return;
    state.deletingId = item.id;
    el("confirmMessage").textContent = `Bạn muốn xóa “${item.title}”? Thao tác này sẽ xóa khỏi danh sách mà sếp đang xem.`;
    openDialog("confirmDialog");
  }

  async function deleteEntry() {
    if (!state.admin || !state.deletingId || state.busy) return;
    state.busy = true;
    el("confirmDeleteButton").disabled = true;
    try {
      if (state.mode === "live") {
        const { error } = await state.client.from("video_items")
          .delete().eq("id", state.deletingId);
        if (error) throw error;
        await loadEntries(true);
      } else {
        state.entries = state.entries.filter(item => item.id !== state.deletingId);
        storageSet();
        render();
      }
      closeDialog("confirmDialog");
      toast("Đã xóa nội dung.");
    } catch (error) {
      toast("Không thể xóa: " + (error.message || "Lỗi chưa xác định"), true);
    } finally {
      state.busy = false;
      state.deletingId = null;
      el("confirmDeleteButton").disabled = false;
    }
  }

  async function reorder(id, direction) {
    if (!state.admin || state.busy) return;
    const items = ordered();
    const index = items.findIndex(item => String(item.id) === String(id));
    const neighbor = index + direction;
    if (index < 0 || neighbor < 0 || neighbor >= items.length) return;
    state.busy = true;
    try {
      const reordered = [...items];
      [reordered[index], reordered[neighbor]] = [reordered[neighbor], reordered[index]];
      const firstPos = Number(items[index].position);
      const secondPos = Number(items[neighbor].position);
      if (state.mode === "live") {
        // In the normal case, swap just two positions for fast editing.
        // Normalize the list only if imported records share the same position.
        const changes = Number.isFinite(firstPos) && Number.isFinite(secondPos) && firstPos !== secondPos
          ? [[items[index].id, secondPos], [items[neighbor].id, firstPos]]
          : reordered.map((item, i) => [item.id, i + 1]);
        for (const [rowId, position] of changes) {
          const { error } = await state.client.from("video_items")
            .update({ position }).eq("id", rowId);
          if (error) throw error;
        }
        await loadEntries(true);
      } else {
        reordered.forEach((item, i) => { item.position = i + 1; });
        storageSet();
        render();
      }
      toast("Đã thay đổi thứ tự nội dung.");
    } catch (error) {
      toast("Không thể đổi thứ tự: " + (error.message || "Lỗi chưa xác định"), true);
      if (state.mode === "live") await loadEntries(true);
    } finally {
      state.busy = false;
      render();
    }
  }

  function playerEmbed(raw) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
        const candidate = host === "youtu.be" ? url.pathname.slice(1).split("/")[0] :
          url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/") || url.pathname.startsWith("/embed/")
            ? url.pathname.split("/")[2] : url.searchParams.get("v");
        if (candidate && /^[a-zA-Z0-9_-]{6,20}$/.test(candidate))
          return `https://www.youtube-nocookie.com/embed/${candidate}?rel=0`;
      }
      if (host === "vimeo.com" || host === "player.vimeo.com") {
        const id = url.pathname.match(/\b(\d{6,15})\b/)?.[1];
        if (id) return `https://player.vimeo.com/video/${id}`;
      }
      if (host === "drive.google.com") {
        const id = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (id) return `https://drive.google.com/file/d/${id}/preview`;
      }
      if (host === "loom.com" || host === "www.loom.com") {
        const id = url.pathname.match(/\/share\/([a-zA-Z0-9]+)/)?.[1];
        if (id) return `https://www.loom.com/embed/${id}`;
      }
      return null;
    } catch { return null; }
  }

  function playVideo(item) {
    if (!item?.url) return;
    el("playerTitle").textContent = item.title;
    el("playerExternal").href = item.url;
    const slot = el("playerContainer");
    slot.replaceChildren();
    const embed = playerEmbed(item.url);
    if (embed) {
      const iframe = document.createElement("iframe");
      iframe.className = "player-embed";
      iframe.src = embed;
      iframe.title = item.title;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      slot.append(iframe);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "player-fallback";
      const msg = document.createElement("p");
      msg.textContent = "Nền tảng này không hỗ trợ phát video trực tiếp trên trang. Nhấn “Mở video gốc” để xem nội dung.";
      placeholder.append(msg);
      slot.append(placeholder);
    }
    openDialog("playerDialog");
  }

  async function login(event) {
    event.preventDefault();
    if (state.mode !== "live") return;
    const btn = el("loginSubmit");
    btn.disabled = true;
    el("loginError").hidden = true;
    try {
      const email = el("loginEmail").value.trim();
      const password = el("loginPassword").value;
      const { data, error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const admin = await isAllowedAdmin(data.user?.email);
      const reviewer = !admin && await isAllowedReviewer(data.user?.email);
      if (!admin && !reviewer) {
        await state.client.auth.signOut();
        throw new Error("Email chưa được cấp quyền. Hãy thêm tài khoản vào video_admins hoặc video_reviewers trong Supabase.");
      }
      state.admin = admin;
      state.reviewer = reviewer;
      updateAdminUI();
      closeDialog("loginDialog");
      el("loginPassword").value = "";
      toast(state.admin ? "Đã đăng nhập quản trị: có thể sửa video và đánh dấu trạng thái." : "Đã đăng nhập tài khoản sếp: có thể đánh dấu Đã quay / Chưa quay.");
    } catch (error) {
      el("loginError").textContent = error.message || "Không thể đăng nhập.";
      el("loginError").hidden = false;
    } finally { btn.disabled = false; }
  }

  async function toggleAdmin() {
    if (state.mode === "demo") {
      state.admin = !state.admin;
      updateAdminUI();
      toast(state.admin ? "Đã bật chỉnh sửa bản xem thử (chỉ lưu trên máy này)." : "Đã tắt chế độ chỉnh sửa.");
      return;
    }
    if (state.mode !== "live") return toast("Chưa kết nối cơ sở dữ liệu.", true);
    if (state.admin || state.reviewer) {
      await state.client.auth.signOut();
      state.admin = false;
      state.reviewer = false;
      updateAdminUI();
      toast("Đã thoát quản trị.");
    } else openDialog("loginDialog");
  }

  async function copyShare() {
    if (location.protocol === "file:") {
      toast("Hãy đưa website lên GitHub Pages trước khi gửi link cho sếp.", true);
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(location.origin + location.pathname);
        toast("Đã sao chép link website để gửi cho sếp.");
      } else throw new Error("Clipboard không khả dụng");
    } catch { toast("Hãy sao chép đường dẫn trên thanh địa chỉ trình duyệt.", true); }
  }

  function attachEvents() {
    el("adminButton").addEventListener("click", () => void toggleAdmin());
    el("shareButton").addEventListener("click", () => void copyShare());
    el("addButton").addEventListener("click", () => showEditor());
    el("emptyAddButton").addEventListener("click", () => showEditor());
    el("editForm").addEventListener("submit", event => void saveEntry(event));
    el("loginForm").addEventListener("submit", event => void login(event));
    el("confirmDeleteButton").addEventListener("click", () => void deleteEntry());
    el("searchInput").addEventListener("input", event => {
      state.term = event.target.value.trim().toLocaleLowerCase("vi-VN");
      render();
    });
    document.querySelectorAll("[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach(b => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        render();
      });
    });
    el("videoTableBody").addEventListener("change", event => {
      const checkbox = event.target.closest("input.filming-checkbox[data-id]");
      if (!checkbox) return;
      void updateFilmingStatus(checkbox.dataset.id, checkbox.checked);
    });
    el("videoTableBody").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = state.entries.find(entry => String(entry.id) === button.dataset.id);
      if (!item) return;
      switch (button.dataset.action) {
        case "play": playVideo(item); break;
        case "edit": showEditor(item); break;
        case "delete": askDelete(item); break;
        case "up": void reorder(item.id, -1); break;
        case "down": void reorder(item.id, +1); break;
      }
    });
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeDialog(btn.dataset.close));
    });
    document.querySelectorAll("dialog").forEach(dialog => {
      dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(dialog.id); });
      dialog.addEventListener("close", () => {
        if (dialog.id === "playerDialog") el("playerContainer").replaceChildren();
      });
    });
  }

  void init();
})();
