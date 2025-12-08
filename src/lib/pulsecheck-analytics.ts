
import type { Answer, Question, SelectedQuestion, SurveyResponse } from '@/types/activity';

// --- JSDoc Types for Clarity ---

/**
 * @typedef {object} NpsResult
 * @property {number} score - The final NPS score (-100 to 100).
 * @property {number} promoters - Count of promoters (score 9-10).
 * @property {number} passives - Count of passives (score 7-8).
 * @property {number} detractors - Count of detractors (score 0-6).
 * @property {number} total - Total number of responses.
 */

/**
 * @typedef {object} LikertResult
 * @property {number} score - The favorability score (0 to 100).
 * @property {number} average - The average score (1 to 5).
 * @property {Record<number, number>} distribution - Count of responses for each score value.
 * @property {number} count - Total number of responses.
 */

/**
 * @typedef {object} CategoryScore
 * @property {number} score - The average favorability score for the category.
 * @property {'excelente' | 'bom' | 'atencao' | 'critico'} status - The qualitative status of the category.
 * @property {Record<string, LikertResult>} questionScores - Individual scores for each Likert question in the category.
 */


// --- Core Calculation Functions ---

/**
 * Calculates the Net Promoter Score (NPS) from a list of scores.
 * This function can be used for both eNPS and Leadership NPS (lNPS).
 *
 * @param {number[]} scores - An array of numerical scores from 0 to 10.
 * @returns {NpsResult} An object containing the NPS score and distribution counts. Returns a zero-state object if scores are empty.
 */
export function calculateNPS(scores: number[]): NpsResult {
  if (!scores || scores.length === 0) {
    return { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
  }

  let promoters = 0;
  let detractors = 0;
  let passives = 0;

  scores.forEach(score => {
    if (score >= 9) promoters++;
    else if (score <= 6) detractors++;
    else passives++;
  });

  const total = scores.length;
  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;
  
  const score = Math.round(promoterPercentage - detractorPercentage);

  return { score, promoters, passives, detractors, total };
}

/**
 * Calculates the favorability score for a single Likert-scale question.
 *
 * @param {number[]} scores - An array of numerical scores from 1 to 5.
 * @returns {LikertResult} An object containing the favorability score, average, and distribution.
 */
export function calculateLikertScore(scores: number[]): LikertResult {
  if (!scores || scores.length === 0) {
    return { score: 0, average: 0, distribution: {}, count: 0 };
  }

  const total = scores.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const average = sum / total;

  // Converts a 1-5 scale to a 0-100 favorability score.
  // 1 -> 0%, 3 -> 50%, 5 -> 100%
  const score = ((average - 1) / 4) * 100;
  
  const distribution = scores.reduce((acc, score) => {
    acc[score] = (acc[score] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return { score: Math.round(score), average, distribution, count: total };
}

/**
 * Derives a qualitative status based on a favorability score.
 *
 * @param {number} score - The favorability score (0-100).
 * @returns {'excelente' | 'bom' | 'atencao' | 'critico'} The status label.
 */
export function getCategoryStatus(score: number): 'excelente' | 'bom' | 'atencao' | 'critico' {
    if (score >= 80) return 'excelente';
    if (score >= 60) return 'bom';
    if (score >= 40) return 'atencao';
    return 'critico';
}


/**
 * Calculates the average favorability score for a category of questions.
 *
 * @param {SelectedQuestion[]} questions - The questions within the category.
 * @param {Record<string, Answer[]>} answersByQuestionId - A map of answers for each question.
 * @returns {CategoryScore} An object with the overall category score, status, and individual question scores.
 */
export function calculateCategoryScore(
    questions: SelectedQuestion[],
    answersByQuestionId: Record<string, Answer[]>
): CategoryScore {
    const likertQuestions = questions.filter(q => q.type === 'likert');
    if (likertQuestions.length === 0) {
        return { score: -1, status: 'bom', questionScores: {} }; // -1 indicates not applicable
    }

    const questionScores: Record<string, LikertResult> = {};
    let totalScoreSum = 0;
    let scoredQuestionsCount = 0;

    likertQuestions.forEach(q => {
        const questionAnswers = (answersByQuestionId[q.id] || []).map(a => a.answer as number);
        const result = calculateLikertScore(questionAnswers);
        questionScores[q.id] = result;
        if (result.count > 0) {
            totalScoreSum += result.score;
            scoredQuestionsCount++;
        }
    });
    
    const averageCategoryScore = scoredQuestionsCount > 0 ? Math.round(totalScoreSum / scoredQuestionsCount) : 0;
    
    return {
        score: averageCategoryScore,
        status: getCategoryStatus(averageCategoryScore),
        questionScores
    };
}


/**
 * Calculates the response rate.
 * @param {number} totalEmployees - The total number of employees invited to respond.
 * @param {number} totalResponses - The total number of responses received.
 * @returns {{ rate: number, responded: number, pending: number }}
 */
export function calculateResponseRate(totalEmployees: number, totalResponses: number) {
    if (totalEmployees === 0) {
        return { rate: 0, responded: totalResponses, pending: 0 };
    }
    const rate = (totalResponses / totalEmployees) * 100;
    return {
        rate: Math.round(rate * 10) / 10, // 1 decimal place
        responded: totalResponses,
        pending: totalEmployees - totalResponses
    };
}


// --- Stubbed Functions for Future Implementation ---

/**
 * STUB: Analyzes and segments responses based on a demographic field.
 * @param {SurveyResponse[]} responses - All responses for the survey.
 * @param {string} segmentField - The demographic field to segment by (e.g., 'department').
 * @returns {object} A comparison of scores between different segments.
 */
export function segmentAnalysis(responses: SurveyResponse[], segmentField: string) {
  // TODO: Implement logic to group responses by segmentField and run calculations
  // for each group. This requires demographic questions to be identifiable.
  console.warn(`segmentAnalysis for '${segmentField}' is not yet implemented.`);
  return {};
}

/**
 * STUB: Identifies categories with the lowest scores.
 * @param {Record<string, CategoryScore>} categoryScores - The scores for all categories.
 * @returns {Array<{category: string, score: number}>} A sorted list of categories that need attention.
 */
export function getTopIssues(categoryScores: Record<string, CategoryScore>) {
  // TODO: Implement logic to filter and sort categories by score.
  const issues = Object.entries(categoryScores)
    .filter(([, data]) => data.score >= 0 && data.score < 60)
    .sort(([, a], [, b]) => a.score - b.score)
    .map(([category, data]) => ({ category, score: data.score }));
  
  console.warn('getTopIssues is a stub and may not be fully featured.');
  return issues;
}

/**
 * STUB: Compares scores between two different survey periods.
 * @param {object} currentSurveyAnalytics - The analyzed data for the current survey.
 * @param {object} previousSurveyAnalytics - The analyzed data for the previous survey.
 * @returns {{ improvements: any[], declines: any[], stable: any[] }} An object detailing trends.
 */
export function analyzeTrends(currentSurveyAnalytics: object, previousSurveyAnalytics: object) {
  // TODO: Implement detailed comparison logic between two sets of analytics data.
  console.warn('analyzeTrends is not yet implemented.');
  return { improvements: [], declines: [], stable: [] };
}
