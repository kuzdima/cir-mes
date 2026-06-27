const express = require('express');
const router = express.Router();

// Создаем простые роутинги для CRUD операций для таблиц справочников
module.exports = function (pool, auth, referenceTablesList) {

    for (const table of referenceTablesList) {
        // GET получаем все значения справочника
        router.get(`/${table}`, auth, async function (req, res) {
            try {
                const { rows } = await pool.query(`SELECT * FROM ${table}`);
                res.json({
                    ok: true,
                    rows: rows
                });
            } catch (error) {
                console.error(`Error fetching all records in table ${table}:`, error);
                res.status(500).json({
                    ok: false,
                    message: 'Ошибка при получении данных',
                    error: error.message
                });
            }
        }
        );

        // GET Получаем значение из справочника по ID
        router.get(`/${table}/:id`, auth, async function (req, res) {
            try {
                const { id } = req.params;
                const { rows } = await pool.query(
                    `SELECT * FROM ${table} WHERE id = $1`,
                    [id]
                );

                if (rows.length === 0) {
                    return res.status(404).json({
                        ok: false,
                        message: 'Запись не найдена'
                    });
                }

                res.json({
                    ok: true,
                    row: rows[0]
                });
            } catch (error) {
                console.error('Error fetching record by ID:', error);
                res.status(500).json({
                    ok: false,
                    message: 'Ошибка при получении данных',
                    error: error.message
                });
            }
        }
        );

        // POST Создаем новое значение в справочнике
        router.post(`/${table}`, auth,
            async function (req, res) {
                try {
                    const { name } = req.body;

                    if (!name) {
                        return res.status(400).json({
                            ok: false,
                            message: 'Поле "name" обязательно'
                        });
                    };

                    const { rows } = await pool.query(
                        `SELECT * FROM ${table} WHERE name = $1`,
                        [name]
                    );
                    // Проверяем на дубли чтоб не плодить
                    if (rows.length > 0) {
                        return res.status(400).json({
                            ok: false,
                            message: 'В справочнике уже есть такое значение'
                        });
                    }

                    const insertResult = await pool.query(
                        `INSERT INTO ${table} (name) VALUES ($1)`,
                        [name]
                    );

                    const newRecord = await pool.query(
                        `SELECT * FROM ${table} WHERE id = $1`,
                        [insertResult.id]
                    );

                    res.status(201).json({
                        ok: true,
                        message: 'Запись успешно создана',
                        row: newRecord.rows[0]
                    });
                } catch (error) {
                    console.error('Error creating record:', error);
                    res.status(500).json({
                        ok: false,
                        message: 'Ошибка при создании записи',
                        error: error.message
                    });
                }
            }
        );

        // PATCH Изменяем существующее значение из справочника по ID
        router.patch(`/${table}/:id`, auth,
            async function (req, res) {
                try {
                    const { id } = req.params;
                    const { name } = req.body;

                    if (!name) {
                        return res.status(400).json({
                            ok: false,
                            message: 'Поле "name" обязательно'
                        });
                    }

                    // Проверяем существование записи
                    const existing = await pool.query(
                        `SELECT * FROM ${table} WHERE id = $1`,
                        [id]
                    );

                    if (existing.rows.length === 0) {
                        return res.status(404).json({
                            ok: false,
                            message: 'Запись не найдена'
                        });
                    }

                    await pool.query(
                        `UPDATE ${table} SET name = $1 WHERE id = $2`,
                        [name, id]
                    );

                    const updated = await pool.query(
                        `SELECT * FROM ${table} WHERE id = $1`,
                        [id]
                    );

                    res.json({
                        ok: true,
                        message: 'Запись успешно обновлена',
                        data: updated.rows[0]
                    });
                } catch (error) {
                    console.error('Error updating record:', error);
                    res.status(500).json({
                        ok: false,
                        message: 'Ошибка при обновлении записи',
                        error: error.message
                    });
                }
            }
        );

        // DELETE Удаляем существующее значение из справочника по ID
        router.delete(`/${table}/:id`, auth,
            async function (req, res) {
                try {
                    const { id } = req.params;

                    // Проверяем существование записи
                    const existing = await pool.query(
                        `SELECT * FROM ${table} WHERE id = $1`,
                        [id]
                    );

                    if (existing.rows.length === 0) {
                        return res.status(404).json({
                            ok: false,
                            message: 'Запись не найдена'
                        });
                    }

                    await pool.query(
                        `DELETE FROM ${table} WHERE id = $1`,
                        [id]
                    );

                    res.json({
                        ok: true,
                        message: 'Запись успешно удалена'
                    });
                } catch (error) {
                    console.error('Error deleting record:', error);
                    res.status(500).json({
                        ok: false,
                        message: 'Ошибка при удалении записи',
                        error: error.message
                    });
                }
            }
        );
    }

    return router
}

