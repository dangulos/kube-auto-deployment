var express = require("express");
var https = require("https");
var http = require("http");

var port = process.env.PORT_SERVICE1 || 420;

var app = express();

//https://github.com/godaddy/kubernetes-client
//Cliente que maneja kubernetes desde node
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;
var deploymentManifest = require('./templates/itrm-deployment.json');
var serviceManifest = require('./templates/itrm-service.json');


//Controladores
//Se pasarán a otro archivo

//Crea un pod con las especificaiones de itrm-deployment.json
//si ya existe un pod con ese nombre, lo vuelve a crear
async function applyDeploy (name) {
    return new Promise(async function(response,reject){
        const client = new Client({ config: config.fromKubeconfig(), version: '1.13' })
        
        deploymentManifest.metadata.name = name;
        //deploymentManifest.metadata.labels.app = name;
        //deploymentManifest.spec.selector.matchLabels.app = name;
        //deploymentManifest.spec.template.metadata.labels.app = name;
        serviceManifest.metadata.name = name;
        //serviceManifest.spec.selector.app = name;

        try{
            console.log('ingress: ', await client.apis.extensions.v1beta1.namespaces('default').ingresses.get)
        }catch(e){
            console.log(e)
        }

        try {
        const createDeployment = await client.apis.apps.v1.namespaces('default').deployments.post({ body: deploymentManifest });
        const createService = await client.api.v1.namespaces('default').services.post({ body: serviceManifest });
        //console.log('deployment:', createDeployment,"\nservice:", createService);
        let r = {
            "deployment":createDeployment,
            "service":createService
        };
        response(r);
        } catch (err) {
        if (err.code !== 409) {
            reject("There was an error");
            throw err;
        }
        const ingresses = await client.apis.extensions.v1beta1.ingresses.get();
        const replace = await client.apis.apps.v1.namespaces('default').deployments(''+name).put({ body: deploymentManifest })
        console.log('Replace:', replace)
        console.log('ingress', ingresses)
        response({"deployment":replace,"ingress": ingresses});
        }
    });
};  

//elimina un pod con el mobre 'itrm-deployment'
async function deletePod(name){
    return new Promise(async function(response,reject){
        const client = new Client({ config: config.fromKubeconfig(), version: '1.13' });

        try{
            const replace = await client.apis.apps.v1.namespaces('default').deployments(''+name).delete();
            const createService = await client.api.v1.namespaces('default').services(''+name).delete();
            console.log("delete succesful!");
            response({"deployment":replace,"service":createService});
        } catch(err){
            console.log("There was an err: ", err);
            reject("There was an error");
        } 
    });
};

//rutas, se pasarán a otro archivo

app.get("/", function (req, res) {
    applyDeploy(req.query.name).then((response,reject)=>{
        //console.log("params: ",req.query("name"));
        if(reject) res.status(500).json({error: "Internal server error"});
        res.status(200).json({msg: response});
    });
});

app.delete("/", function (req, res){
    deletePod(req.query.name).then((response,reject)=>{
        if(reject) res.status(500).json({error: "Internal server error"});
        res.status(200).json({msg: response});
    });
});

app.listen(port);
console.log("Hello! Api service running on port " + port);