export interface DocumentContent {
    title: string;
    generalDescription: string;
    tasks: string[];
    activities: { title: string; hours: number }[];
    deliveryTime: string;
    notes: string;
}