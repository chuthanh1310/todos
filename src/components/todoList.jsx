
import { useEffect, useRef } from "react";
import Sortable from "sortablejs";

export default function TodoList({
  todos,
  onToggle,
  onDelete,
  onReorder,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;

    const sortable = Sortable.create(listRef.current, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "opacity-40",

      onEnd(event) {
        if (
          event.oldIndex == null ||
          event.newIndex == null ||
          event.oldIndex === event.newIndex
        ) {
          return;
        }

        onReorder(event.oldIndex, event.newIndex);
      },
    });

    return () => sortable.destroy();
  }, [onReorder]);

  return (
    <ul ref={listRef} className="space-y-3">
      {todos.map((todo) => (
        <li
          key={todo.id}
          data-id={todo.id}
          className="flex items-center gap-3 rounded-xl
                     border border-gray-200 bg-white p-4"
        >
          <button
            type="button"
            className="drag-handle cursor-grab text-gray-400"
            aria-label="Kéo để sắp xếp"
          >
            ⠿
          </button>

          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo)}
            aria-label="Đánh dấu hoàn thành"
          />

          <span
            className={`flex-1 break-words ${
              todo.completed
                ? "text-gray-400 line-through"
                : "text-gray-800"
            }`}
          >
            {todo.title}
          </span>

          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            className="text-red-500 hover:text-red-700"
          >
            Xóa
          </button>
        </li>
      ))}
    </ul>
  );
}
