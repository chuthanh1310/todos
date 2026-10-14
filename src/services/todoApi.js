const API_URL = import.meta.env.VITE_TODO_API_URL;

async function request(url, options = {}) {
  if (!API_URL) {
    throw new Error("Chưa cấu hình VITE_TODO_API_URL trong file .env");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`MockAPI trả về lỗi HTTP ${response.status}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export const todoApi = {
  async getAll() {
    const todos = await request(API_URL);

    return todos.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  },

  create(title, order = 0) {
    return request(API_URL, {
      method: "POST",
      body: JSON.stringify({
        title,
        completed: false,
        order,
      }),
    });
  },

  update(id, data) {
    return request(`${API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  remove(id) {
    return request(`${API_URL}/${id}`, {
      method: "DELETE",
    });
  },

  async saveOrder(todos) {
    const results = await Promise.allSettled(
      todos.map((todo, index) =>
        todoApi.update(todo.id, {
          order: Number(index),
        }),
      ),
    );

    const failed = results.filter((result) => result.status === "rejected");

    if (failed.length > 0) {
      throw new Error(`Không lưu được thứ tự của ${failed.length} công việc`);
    }
  },
};
