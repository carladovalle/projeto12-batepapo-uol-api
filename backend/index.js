import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from 'joi';

dotenv.config();

import dayjs from 'dayjs';

const participantSchema = joi.object({
	name: joi.string().required().pattern(/^[a-z]+$/i),
	lastStatus: joi.number()
})

const messageSchema = joi.object({
	to: joi.string().required().pattern(/^[a-z]+$/i),
	text: joi.string().required(),
	type: joi.string().required().valid("message").valid("private_message"),
})

const app = express();

const PORT = process.env.PORTA;

app.use(cors());
app.use(express.json());

let db;
const mongoClient = new MongoClient(process.env.MONGO_URI);

setInterval(async () => {
	
    try {
		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

        const participants = await db.collection("participants").find({}).toArray();
        const lastStatusNow = Date.now();

        for (const participant of participants) {
            if (participant.lastStatus < lastStatusNow - 10000) {
                await db.collection("participants").deleteOne({ lastStatus: participant.lastStatus });
                await db.collection("messages").insertOne(
                    {
                        from: participant.name, 
                        to: 'Todos', 
                        text: 'sai da sala...', 
                        type: 'status', 
                        time: dayjs().format('HH:mm:ss')
                    }
                )
            }
        }
        mongoClient.close();
    } catch (err) {
		console.log(err);
    }
}, 15000);

app.get('/participants', async (req, res) => {
	
	try {

		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

		const participants = await db.collection("participants").find().toArray();

		res.send(participants); 
		mongoClient.close();

	} catch (error) {

		res.status(500).send("Deu ruim");
		mongoClient.close();

	}

})

app.post('/participants', async (req, res) => {

	const newParticipant = req.body;
	const validou = participantSchema.validate(newParticipant, {abortEarly: false});
	const { error } = validou;

	if(error) {
		const messages = error.details.map(item => item.message);
		res.send(messages);
		return;
	}

	try {

		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

		const {name, lastStatus} = req.body;
		
		const participant = await db.collection('participants').findOne({ name });
		if (participant) {
		res.status(409).send('User already exists');
		return;
		}

		await db.collection("participants").insertOne({name: name, lastStatus: Date.now()});
		await db.collection("messages").insertOne({
			from: name,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time: dayjs().format('HH:mm:ss'),
		});

		res.sendStatus(201);
		mongoClient.close();

	} catch (error) {

		res.status(500).send("Deu ruim");
		mongoClient.close();

	}

});

app.get('/messages', async (req, res) => {
	
	const {user: from} = req.headers;

	try {

		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

		const messages = await db.collection("messages").find({from: from}).toArray();

		res.send(messages); 
		mongoClient.close();

	} catch (error) {

		res.status(500).send("Deu ruim");
		mongoClient.close();

	}

})

app.post('/messages', async (req, res) => {

	const newMessage = req.body;
	const validou = messageSchema.validate(newMessage, {abortEarly: false});
	const { error } = validou;

	if(error) {
		const m = error.details.map(item => item.message);
		res.send(m);
		return;
	}

	try {

		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

		const {to, text, type} = req.body;
		const {user: from} = req.headers;
	

		await db.collection("messages").insertOne({to: to, text: text, type: type, from: from, time: dayjs().format('HH:mm:ss') });

		res.sendStatus(201);
		mongoClient.close();

	} catch (error) {

		res.status(500).send("Deu ruim");
		mongoClient.close();

	}

});

app.post('/status', async (req, res) => {

	const {user} = req.headers;

	try {

		await mongoClient.connect();
		const db = mongoClient.db('bate_papo_uol');

		const verification = await db.collection("participants").findOne({name: user})

		if(verification) {
			await db.collection("participants").updateOne({name: user },{$set: {lastStatus: Date.now()}});
			res.sendStatus(200);
			mongoClient.close();
		} else {
			res.sendStatus(404);
			mongoClient.close();
		}

	} catch (error) {

		res.status(500).send("Deu ruim");
		mongoClient.close();

	}

});

app.listen(PORT, () => {
	console.log(chalk.blue.bold(`Servidor rodando na porta ${PORT}`))
});