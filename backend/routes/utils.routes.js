const express = require('express');
const router = express.Router();

// Создаем простые роутинги для CRUD операций для таблиц справочников
module.exports = function (pool, auth) {

    
        
        // GET получаем все значения справочника
        router.get(`/fieldsInfo/:table`, auth, async function (req, res) {
            try {
                const { table } = req.params;
                
                const { rows } = await pool.query(
                    `
                    SELECT 
                        column_name,
                        data_type,
                        character_maximum_length AS max_length,
                        column_default,
                        is_nullable,
                        col_description(c.table_name::regclass, c.ordinal_position) AS column_comment,
                        foreign_table_name,
                        foreign_column_name
                    FROM 
                        information_schema.columns c
                    LEFT JOIN (SELECT 
                        kcu1.column_name AS source_column,
                        tc.constraint_type,
                        CASE 
                            WHEN tc.constraint_type = 'FOREIGN KEY' THEN kcu2.table_name 
                            ELSE NULL 
                        END AS foreign_table_name,
                        CASE 
                            WHEN tc.constraint_type = 'FOREIGN KEY' THEN kcu2.column_name 
                            ELSE NULL 
                        END AS foreign_column_name
                    FROM 
                        information_schema.table_constraints AS tc
                    JOIN 
                        information_schema.key_column_usage AS kcu1
                        ON tc.constraint_name = kcu1.constraint_name
                        AND tc.table_schema = kcu1.table_schema
                    LEFT JOIN 
                        information_schema.referential_constraints AS rc
                        ON tc.constraint_name = rc.constraint_name
                        AND tc.table_schema = rc.constraint_schema
                    LEFT JOIN 
                        information_schema.key_column_usage AS kcu2
                        ON rc.unique_constraint_name = kcu2.constraint_name
                        AND rc.unique_constraint_schema = kcu2.table_schema
                        AND kcu1.position_in_unique_constraint = kcu2.ordinal_position
                    WHERE 
                        tc.table_schema = 'public'
                        AND tc.table_name = $1
                        AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
                    ORDER BY 
                        tc.constraint_type DESC, source_column) cons
                        on c.column_name = cons.source_column 
                    WHERE 
                        table_schema = 'public' 
                        AND table_name = $1
                    ORDER BY 
                        ordinal_position;
                    `, [table]);
                res.json({
                    ok: true,
                    rows: rows
                });
            } catch (error) {
                console.error(`Error fetching fields info:`, error);
                res.status(500).json({
                    ok: false,
                    message: 'Ошибка при получении данных',
                    error: error.message
                });
            }
        }
        );
    



    return router
}