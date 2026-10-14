
const listeners = new Set();

let todos = [];

export const todoStore = {
  getTodos() {
    return todos;
  },

  subscribe(callback) {
    listeners.add(callback);

    // Trả về hàm hủy đăng ký
    return () => {
      listeners.delete(callback);
    };
  },

  publish(event, data) {
    if (event !== "todos:updated") return;

    todos = data;

    listeners.forEach((callback) => {
      callback(todos);
    });
  },
};
