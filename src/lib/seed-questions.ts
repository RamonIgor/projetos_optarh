import { collection, addDoc, serverTimestamp, getDocs, query, where, Firestore } from 'firebase/firestore';
import type { Question } from '@/types/activity';

const defaultQuestions: Omit<Question, 'id' | 'createdAt' | 'createdBy'>[] = [
    // --- DEMOGRAFIA ---
    {
        text: 'Qual é a sua área/departamento?',
        type: 'multiple-choice',
        category: 'DEMOGRAFIA',
        options: [], // Customizável pelo cliente
        order: 1,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'Há quanto tempo você está na empresa?',
        type: 'multiple-choice',
        category: 'DEMOGRAFIA',
        options: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 2 anos', '2 a 5 anos', 'Mais de 5 anos'],
        order: 2,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'Qual a sua faixa etária?',
        type: 'multiple-choice',
        category: 'DEMOGRAFIA',
        options: ['18-25', '26-35', '36-45', '46-55', '56+'],
        order: 3,
        isMandatory: true,
        isDefault: true,
    },
    // --- eNPS ---
    {
        text: 'Em uma escala de 0 a 10, o quanto você recomendaria a [EMPRESA] como um ótimo lugar para trabalhar para algum familiar ou amigo?',
        type: 'nps',
        category: 'eNPS',
        order: 4,
        isMandatory: true,
        isNpsQuestion: true,
        isDefault: true,
    },
    // --- Liderança NPS ---
    {
        text: 'Avaliando as práticas de gestão de pessoas de sua liderança, em uma escala de 0 a 10, o quanto você recomendaria sua liderança como um guia eficaz para a equipe?',
        type: 'nps',
        category: 'LEADERSHIP NPS',
        order: 5,
        isMandatory: true,
        isDefault: true,
    },
    // --- DESENVOLVIMENTO PROFISSIONAL ---
    {
        text: 'A empresa me oferece treinamentos visando o meu desenvolvimento profissional.',
        type: 'likert',
        category: 'DESENVOLVIMENTO PROFISSIONAL',
        order: 6,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'A liderança me auxilia no meu desenvolvimento profissional.',
        type: 'likert',
        category: 'DESENVOLVIMENTO PROFISSIONAL',
        order: 7,
        isMandatory: true,
        isDefault: true,
    },
    // --- RECONHECIMENTO E REMUNERAÇÃO ---
    {
        text: 'Todos aqui têm as mesmas oportunidades de serem reconhecidos.',
        type: 'likert',
        category: 'RECONHECIMENTO E REMUNERAÇÃO',
        order: 8,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'Todos os colaboradores são pagos adequadamente pelas atividades que exercem.',
        type: 'likert',
        category: 'RECONHECIMENTO E REMUNERAÇÃO',
        order: 9,
        isMandatory: true,
        isDefault: true,
    },
    // --- AMBIENTE DE TRABALHO ---
    {
        text: 'O ambiente de trabalho é psicológica e emocionalmente saudável.',
        type: 'likert',
        category: 'AMBIENTE DE TRABALHO',
        order: 10,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'Eu me sinto seguro no ambiente de trabalho.',
        type: 'likert',
        category: 'AMBIENTE DE TRABALHO',
        order: 11,
        isMandatory: true,
        isDefault: true,
    },
    // --- INFRAESTRUTURA ---
    {
        text: 'A empresa oferece os materiais necessários para realização do trabalho.',
        type: 'likert',
        category: 'INFRAESTRUTURA',
        order: 12,
        isMandatory: true,
        isDefault: true,
    },
    // --- LIDERANÇA - COMUNICAÇÃO ---
    {
        text: 'A liderança deixa clara as suas expectativas.',
        type: 'likert',
        category: 'LIDERANÇA - COMUNICAÇÃO',
        order: 13,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'É fácil se aproximar da liderança e falar com ela.',
        type: 'likert',
        category: 'LIDERANÇA - COMUNICAÇÃO',
        order: 14,
        isMandatory: true,
        isDefault: true,
    },
    // --- LIDERANÇA - CULTURA ---
    {
        text: 'A liderança reconhece erros não intencionais como parte do negócio.',
        type: 'likert',
        category: 'LIDERANÇA - CULTURA',
        order: 15,
        isMandatory: true,
        isDefault: true,
    },
    {
        text: 'A liderança age de forma educada e respeitosa com os colaboradores.',
        type: 'likert',
        category: 'LIDERANÇA - CULTURA',
        order: 16,
        isMandatory: true,
        isDefault: true,
    },
    // --- LIDERANÇA - FEEDBACK ---
    {
        text: 'A liderança realiza feedbacks constantes como forma de desenvolvimento.',
        type: 'likert',
        category: 'LIDERANÇA - FEEDBACK',
        order: 17,
        isMandatory: true,
        isDefault: true,
    },
    // --- FEEDBACK ABERTO ---
    {
        text: 'Espaço aberto para você incluir sugestões sobre a empresa',
        type: 'open-text',
        category: 'FEEDBACK ABERTO',
        order: 18,
        isMandatory: false,
        isDefault: true,
    },
    {
        text: 'Espaço aberto para você incluir sugestões sobre liderança',
        type: 'open-text',
        category: 'FEEDBACK ABERTO',
        order: 19,
        isMandatory: false,
        isDefault: true,
    }
];

export async function seedDefaultQuestions(db: Firestore) {
    const questionsRef = collection(db, 'pulse_check_questions');
    let addedCount = 0;
    let skippedCount = 0;

    for (const q of defaultQuestions) {
        // Check if a question with the same text already exists
        const checkQuery = query(questionsRef, where('text', '==', q.text));
        const existingDocs = await getDocs(checkQuery);

        if (existingDocs.empty) {
            const questionData = {
                ...q,
                createdBy: 'system', // Indicates a default system question
                createdAt: serverTimestamp(),
            };
            await addDoc(questionsRef, questionData);
            addedCount++;
        } else {
            skippedCount++;
        }
    }
    
    return { addedCount, skippedCount };
}
