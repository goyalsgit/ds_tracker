-- ═══════════════════════════════════════════════════════════════════════════
-- DATABASE USAGE CHECKER
-- Run this in Supabase SQL Editor to see your actual storage usage
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. COUNT ALL RECORDS
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    'Total Questions' as metric,
    COUNT(*) as count,
    pg_size_pretty(pg_total_relation_size('questions')) as table_size
FROM questions

UNION ALL

SELECT 
    'Your Solves' as metric,
    COUNT(*) as count,
    pg_size_pretty(pg_total_relation_size('solves')) as table_size
FROM solves
WHERE user_id = (
    SELECT id FROM user_profiles 
    WHERE email = 'devanshgoyal7344@gmail.com'  -- Replace with your email
    LIMIT 1
)

UNION ALL

SELECT 
    'Your Revisions' as metric,
    COUNT(*) as count,
    pg_size_pretty(pg_total_relation_size('revisions')) as table_size
FROM revisions
WHERE solve_id IN (
    SELECT id FROM solves 
    WHERE user_id = (
        SELECT id FROM user_profiles 
        WHERE email = 'devanshgoyal7344@gmail.com'  -- Replace with your email
        LIMIT 1
    )
);

-- 2. DETAILED STORAGE BREAKDOWN
-- ═══════════════════════════════════════════════════════════════════════════
WITH user_data AS (
    SELECT id FROM user_profiles 
    WHERE email = 'devanshgoyal7344@gmail.com'  -- Replace with your email
    LIMIT 1
),
counts AS (
    SELECT 
        (SELECT COUNT(*) FROM questions) as total_questions,
        (SELECT COUNT(*) FROM solves WHERE user_id = (SELECT id FROM user_data)) as user_solves,
        (SELECT COUNT(*) FROM revisions WHERE solve_id IN (
            SELECT id FROM solves WHERE user_id = (SELECT id FROM user_data)
        )) as user_revisions
)
SELECT 
    total_questions,
    user_solves,
    user_revisions,
    -- Estimated storage (bytes)
    (total_questions * 500) as questions_bytes,
    (user_solves * 200) as solves_bytes,
    (user_revisions * 100) as revisions_bytes,
    -- Total storage
    (total_questions * 500 + user_solves * 200 + user_revisions * 100) as total_bytes,
    -- Convert to MB
    ROUND((total_questions * 500 + user_solves * 200 + user_revisions * 100)::numeric / 1024 / 1024, 2) as total_mb,
    -- Percentage of 500 MB free tier
    ROUND(((total_questions * 500 + user_solves * 200 + user_revisions * 100)::numeric / 1024 / 1024 / 500 * 100), 2) as percentage_used,
    -- Remaining capacity
    ROUND((500 - (total_questions * 500 + user_solves * 200 + user_revisions * 100)::numeric / 1024 / 1024), 2) as remaining_mb,
    -- How many more problems can be stored
    FLOOR((500 - (total_questions * 500 + user_solves * 200 + user_revisions * 100)::numeric / 1024 / 1024) * 1024 * 1024 / 1000) as remaining_problems
FROM counts;

-- 3. ACTUAL DATABASE SIZE (REAL STORAGE)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('questions', 'solves', 'revisions', 'user_profiles', 'settings')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. TOTAL DATABASE SIZE
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as total_database_size,
    pg_database_size(current_database()) as size_bytes,
    ROUND(pg_database_size(current_database())::numeric / 1024 / 1024, 2) as size_mb,
    ROUND((pg_database_size(current_database())::numeric / 1024 / 1024 / 500 * 100), 2) as percentage_of_free_tier;

-- 5. YOUR PROBLEM BREAKDOWN
-- ═══════════════════════════════════════════════════════════════════════════
WITH user_data AS (
    SELECT id FROM user_profiles 
    WHERE email = 'devanshgoyal7344@gmail.com'  -- Replace with your email
    LIMIT 1
)
SELECT 
    q.difficulty,
    COUNT(*) as problems_solved,
    COUNT(*) * 1000 as estimated_bytes,
    ROUND((COUNT(*) * 1000)::numeric / 1024, 2) as estimated_kb
FROM solves s
JOIN questions q ON s.question_id = q.id
WHERE s.user_id = (SELECT id FROM user_data)
GROUP BY q.difficulty
ORDER BY 
    CASE q.difficulty 
        WHEN 'Easy' THEN 1 
        WHEN 'Medium' THEN 2 
        WHEN 'Hard' THEN 3 
    END;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPLANATION OF QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

/*
Query 1: COUNT ALL RECORDS
- Shows how many questions, solves, and revisions you have
- Shows the actual table size on disk

Query 2: DETAILED STORAGE BREAKDOWN
- Estimates storage based on average record sizes:
  * Question: 500 bytes (title, slug, url, difficulty, tags array)
  * Solve: 200 bytes (user_id, question_id, timestamps, code)
  * Revision: 100 bytes (solve_id, stage, due_on, status)
- Calculates total MB used and percentage of 500 MB free tier
- Shows how many more problems you can store

Query 3: ACTUAL DATABASE SIZE
- Shows REAL storage used by each table (includes indexes, overhead)
- More accurate than estimates

Query 4: TOTAL DATABASE SIZE
- Shows the entire database size
- Includes all tables, indexes, and PostgreSQL overhead

Query 5: YOUR PROBLEM BREAKDOWN
- Shows how many problems you've solved by difficulty
- Estimates storage per difficulty level

IMPORTANT NOTES:
1. Replace 'devanshgoyal7344@gmail.com' with your actual email
2. The "estimated" sizes are approximations
3. The "actual" sizes (pg_size_pretty) are real disk usage
4. PostgreSQL adds overhead (indexes, metadata) so actual > estimated
*/
