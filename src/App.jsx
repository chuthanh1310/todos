import { useCallback, useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import { todoApi } from "./services/todoApi";
import { todoStore } from "./store/todoStore";
import "./App.css";

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
  </svg>
);

const today = new Date().toLocaleDateString("vi-VN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const todosRef = useRef([]);
  const busyRef = useRef(false);
  const reorderRef = useRef(null);

  // Đồng bộ state React với Pub/Sub
  const publishTodos = useCallback((nextTodos) => {
    todosRef.current = nextTodos;
    todoStore.publish("todos:updated", nextTodos);
  }, []);

  // Đăng ký Pub/Sub và tải dữ liệu từ MockAPI
  useEffect(() => {
    let active = true;

    const unsubscribe = todoStore.subscribe((nextTodos) => {
      if (active) {
        todosRef.current = nextTodos;
        setTodos(nextTodos);
      }
    });

    async function loadTodos() {
      try {
        setLoading(true);
        setError("");
        const data = await todoApi.getAll();
        if (active) publishTodos(data);
      } catch (err) {
        if (active) {
          setError(err.message || "Không tải được danh sách công việc.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTodos();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [publishTodos]);

  // Xử lý kéo thả, sử dụng danh sách mới nhất
  reorderRef.current = async (oldIndex, newIndex) => {
    if (
      busyRef.current ||
      oldIndex == null ||
      newIndex == null ||
      oldIndex === newIndex
    ) {
      return;
    }

    const previous = [...todosRef.current];

    if (
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex >= previous.length ||
      newIndex >= previous.length
    ) {
      return;
    }

    const reordered = [...previous];
    const [moved] = reordered.splice(oldIndex, 1);
    if (!moved) return;
    reordered.splice(newIndex, 0, moved);

    const updated = reordered.map((todo, index) => ({
      ...todo,
      order: index,
    }));

    busyRef.current = true;
    setSaving(true);
    setError("");

    // Cập nhật giao diện ngay lập tức
    publishTodos(updated);

    try {
      await todoApi.saveOrder(updated);
    } catch (err) {
      setError(err.message || "Không lưu được thứ tự công việc.");
      try {
        const latest = await todoApi.getAll();
        publishTodos(latest);
      } catch {
        publishTodos(previous);
      }
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  // Khởi tạo SortableJS khi danh sách được hiển thị
  useEffect(() => {
    if (!listRef.current || loading) return;

    const sortable = Sortable.create(listRef.current, {
      animation: 200,
      handle: ".drag-handle",
      draggable: "li[data-id]",
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      forceFallback: true,
      fallbackTolerance: 3,

      onEnd(event) {
        const oldIndex = event.oldDraggableIndex ?? event.oldIndex;
        const newIndex = event.newDraggableIndex ?? event.newIndex;
        reorderRef.current?.(oldIndex, newIndex);
      },
    });

    return () => sortable.destroy();
  }, [loading]);

  // Thêm công việc
  const addTodo = async (event) => {
    event.preventDefault();

    const value = title.trim();
    if (!value || busyRef.current) return;

    busyRef.current = true;
    setSaving(true);
    setError("");

    try {
      const created = await todoApi.create(value, todosRef.current.length);
      publishTodos([...todosRef.current, created]);
      setTitle("");
    } catch (err) {
      setError(err.message || "Không thêm được công việc.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  // Cập nhật trạng thái hoàn thành
  const toggleTodo = async (todo) => {
    if (busyRef.current) return;

    busyRef.current = true;
    setSaving(true);
    setError("");

    try {
      const updatedTodo = await todoApi.update(todo.id, {
        completed: !todo.completed,
      });

      publishTodos(
        todosRef.current.map((item) =>
          item.id === todo.id ? updatedTodo : item
        )
      );
    } catch (err) {
      setError(err.message || "Không cập nhật được trạng thái.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  // Xóa công việc và đồng bộ lại thứ tự
  const deleteTodo = async (id) => {
    if (busyRef.current) return;

    busyRef.current = true;
    setSaving(true);
    setError("");

    try {
      await todoApi.remove(id);

      const remainingTodos = todosRef.current
        .filter((todo) => todo.id !== id)
        .map((todo, index) => ({ ...todo, order: index }));

      publishTodos(remainingTodos);

      try {
        await todoApi.saveOrder(remainingTodos);
      } catch {
        setError("Đã xóa công việc nhưng chưa đồng bộ được thứ tự.");
      }
    } catch (err) {
      setError(err.message || "Không xóa được công việc.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const reload = async () => {
    try {
      setError("");
      publishTodos(await todoApi.getAll());
    } catch (err) {
      setError(err.message || "Không tải lại được dữ liệu.");
    }
  };

  const completed = todos.filter((todo) => todo.completed).length;
  const remaining = todos.length - completed;
  const percent = todos.length ? (completed / todos.length) * 100 : 0;

  return (
    <div className="todo-app">
      {/* Header */}
      <header className="todo-header">
        <div className="todo-brand">
          <div className="todo-logo">
            <CheckIcon />
          </div>
          <div>
            <h1 className="todo-title">Todo List</h1>
            <p className="todo-subtitle">Quản lý công việc của bạn mỗi ngày</p>
          </div>
        </div>
        <div className="todo-date">Hôm nay: {today}</div>
      </header>

      {/* Form thêm công việc */}
      <form className="todo-form" onSubmit={addTodo}>
        <input
          className="todo-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nhập công việc mới..."
          aria-label="Tên công việc mới"
        />
        <button
          className="todo-add-btn"
          type="submit"
          disabled={saving || !title.trim()}
        >
          <span>+</span> Thêm
        </button>
      </form>

      {/* Thông báo lỗi */}
      {error && (
        <div className="todo-error" role="alert">
          {error}
          <button type="button" onClick={reload}>
            Tải lại
          </button>
        </div>
      )}

      {/* Thống kê */}
      <div className="todo-stats">
        <div className="stat">
          <span className="stat-dot" />
          {remaining} việc chưa hoàn thành
        </div>
        <div className="stat stat-progress">
          <span className="stat-check">
            <CheckIcon />
          </span>
          {completed}/{todos.length} hoàn thành
          <div className="progress">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* Danh sách */}
      {loading ? (
        <div className="todo-message">Đang tải danh sách công việc...</div>
      ) : (
        <ul className="todo-list" ref={listRef}>
          {todos.map((todo) => (
            <li
              key={todo.id}
              data-id={todo.id}
              className={`todo-item ${todo.completed ? "is-done" : ""}`}
            >
              <div className="drag-handle" aria-label="Kéo để sắp xếp">
                <span /><span /><span /><span /><span /><span />
              </div>

              <input
                className="todo-check"
                type="checkbox"
                checked={todo.completed}
                disabled={saving}
                onChange={() => toggleTodo(todo)}
                aria-label={`Hoàn thành ${todo.title}`}
              />

              <div className="todo-content">
                <span className="todo-text">{todo.title}</span>
                <span
                  className={`badge ${
                    todo.completed ? "badge-done" : "badge-pending"
                  }`}
                >
                  {todo.completed ? "Đã xong" : "Chưa xong"}
                </span>
              </div>

              <button
                className="todo-delete"
                type="button"
                onClick={() => deleteTodo(todo.id)}
                disabled={saving}
                aria-label={`Xóa ${todo.title}`}
                title="Xóa công việc"
              >
                <TrashIcon />
              </button>
            </li>
          ))}

          {todos.length === 0 && (
            <li className="todo-message">
              Chưa có công việc nào. Hãy thêm công việc đầu tiên!
            </li>
          )}
        </ul>
      )}

      <p className="todo-hint">Kéo thả để sắp xếp thứ tự công việc</p>

      {saving && <p className="todo-saving">Đang đồng bộ dữ liệu...</p>}
    </div>
  );
}

export default App;