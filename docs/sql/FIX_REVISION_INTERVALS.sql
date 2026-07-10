-- Fix revision intervals from old [1,3,7,14,30] to new [3,7,21]
-- Run this in Supabase SQL Editor to update all existing revisions

-- This will recalculate all revision schedules based on the solved_at date
-- and the new intervals [3, 7, 21]

-- Step 1: Delete all existing revisions (they'll be recreated with correct intervals)
DELETE FROM revisions;

-- Step 2: Recreate revisions with correct intervals for each solve
-- This uses a PostgreSQL function to generate the correct dates

DO $$
DECLARE
    solve_record RECORD;
    solved_date DATE;
BEGIN
    -- Loop through all solves
    FOR solve_record IN 
        SELECT id, solved_at 
        FROM solves 
        ORDER BY solved_at
    LOOP
        solved_date := solve_record.solved_at::DATE;
        
        -- Insert Stage 1 (Day 3)
        INSERT INTO revisions (solve_id, stage, due_on, status)
        VALUES (
            solve_record.id,
            1,
            solved_date + INTERVAL '3 days',
            CASE 
                WHEN solved_date + INTERVAL '3 days' < CURRENT_DATE THEN 'overdue'
                ELSE 'scheduled'
            END
        );
        
        -- Insert Stage 2 (Day 7)
        INSERT INTO revisions (solve_id, stage, due_on, status)
        VALUES (
            solve_record.id,
            2,
            solved_date + INTERVAL '7 days',
            CASE 
                WHEN solved_date + INTERVAL '7 days' < CURRENT_DATE THEN 'overdue'
                ELSE 'scheduled'
            END
        );
        
        -- Insert Stage 3 (Day 21)
        INSERT INTO revisions (solve_id, stage, due_on, status)
        VALUES (
            solve_record.id,
            3,
            solved_date + INTERVAL '21 days',
            CASE 
                WHEN solved_date + INTERVAL '21 days' < CURRENT_DATE THEN 'overdue'
                ELSE 'scheduled'
            END
        );
    END LOOP;
END $$;

-- Verify the fix
SELECT 
    q.title,
    s.solved_at::DATE as solved_on,
    r.stage,
    r.due_on,
    r.due_on::DATE - s.solved_at::DATE as days_after_solving,
    r.status
FROM revisions r
JOIN solves s ON r.solve_id = s.id
JOIN questions q ON s.question_id = q.id
ORDER BY s.solved_at DESC, r.stage
LIMIT 20;

-- Expected output:
-- For a problem solved on May 4:
-- Stage 1: May 7 (3 days after)
-- Stage 2: May 11 (7 days after)
-- Stage 3: May 25 (21 days after)
