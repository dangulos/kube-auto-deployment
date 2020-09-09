var express = require("express");
var https = require("https");
var cors = require("cors");
var http = require("http");

const PORT = process.env.PORT || 420;
//const HOST = process.env.HOST || '0.0.0.0';

var app = express();

app.use(cors());

//https://github.com/godaddy/kubernetes-client
//Cliente que maneja kubernetes desde node
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;
var deploymentManifest = require('./templates/itrm-deployment.json');
var serviceManifest = require('./templates/itrm-service.json');
var serviceTVManifest = require('./templates/itrm-servicetv.json');
var ingressManifest = require('./templates/itrm-ingress.json');
var ingressTVManifest = require('./templates/itrm-ingresstv.json');

//Crea un pod con las especificaiones de itrm-deployment.json
//si ya existe un pod con ese nombre, lo vuelve a crear
async function applyDeploy (name) {
    return new Promise(async function(response,reject){
        const client = new Client({ config: config.fromKubeconfig(), version: '1.13' })
        
        deploymentManifest.metadata.name = ""+name;
        deploymentManifest.metadata.labels.app = ""+name;
        deploymentManifest.spec.selector.matchLabels.app = ""+name;
        deploymentManifest.spec.template.metadata.labels.app = ""+name;

        serviceManifest.metadata.name = ""+name;
        serviceManifest.spec.selector.app = ""+name;

        serviceTVManifest.metadata.name = ""+name+"tv";
        serviceTVManifest.spec.selector.app = ""+name+"tv";

        ingressManifest.metadata.name = ""+name;
        ingressManifest.spec.rules[0].http.paths[0].path = "/" + name + "(/|$)(.*)";
        ingressManifest.spec.rules[0].http.paths[0].backend.serviceName = ""+name;

        ingressTVManifest.metadata.name = ""+name+"tv";
        ingressTVManifest.spec.rules[0].http.paths[0].path = "/tv/" + name + "(/|$)(.*)";
        ingressTVManifest.spec.rules[0].http.paths[0].backend.serviceName = ""+name+"tv";

        try {
        const createDeployment = await client.apis.apps.v1.namespaces('default').deployments.post({ body: deploymentManifest });
        const createService = await client.api.v1.namespaces('default').services.post({ body: serviceManifest });
        const createServiceTV = await client.api.v1.namespaces('default').services.post({ body: serviceTVManifest });
        const createIngress = await client.apis.extensions.v1beta1.namespaces('default').ingresses.post({body: ingressManifest});
        const createIngressTV = await client.apis.extensions.v1beta1.namespaces('default').ingresses.post({body: ingressTVManifest});
        console.log('Creating new container');
        let r = {
            "deployment":createDeployment,
            "service":createService,
            "seerviceTV":createServiceTV,
            "ingress":createIngress,
            "ingressTV":createIngressTV
        };
        console.log(r);
        response(r);
        } catch (err) {
        if (err.code !== 409) {
            reject("There was an error");
            throw err;
        }
        const replaceDeploy = await client.apis.apps.v1.namespaces('default').deployments(''+name).put({ body: deploymentManifest });
        const replaceService = await client.api.v1.namespaces('default').services(''+name).put({ body: serviceManifest });
        const replaceService = await client.api.v1.namespaces('default').services(''+name+'tv').put({ body: serviceTVManifest });
        const replaceIngress = await client.apis.extensions.v1beta1.namespaces('default').ingresses(''+name).put({body: ingressManifest});
        const replaceIngressTV = await client.apis.extensions.v1beta1.namespaces('default').ingresses(''+name+'tv').put({body: ingressTVManifest});
        
        console.log(
            {
                "deployment":replaceDeploy,
                "service":replaceService,
                "ingress":replaceIngress,
                "ingressTV":replaceIngressTV
            }
        );
        response({
            "deployment":replaceDeploy,
            "service":replaceService,
            "ingress":replaceIngress,
            "ingressTV":replaceIngressTV
        });
        }
    });
};  

//elimina un pod con el mobre 'itrm-deployment'
async function deletePod(name){
    return new Promise(async function(response,reject){
        const client = new Client({ config: config.fromKubeconfig(), version: '1.13' });

        try{
            const replace = await client.apis.apps.v1.namespaces('default').deployments(''+name).delete();
            const deleteService = await client.api.v1.namespaces('default').services(''+name).delete();
            const deleteServiceTV = await client.api.v1.namespaces('default').services(''+name+'tv').delete();
            const deleteIngress = await client.apis.extensions.v1beta1.namespaces('default').ingresses(''+name).delete();
            const deleteIngressTV = await client.apis.extensions.v1beta1.namespaces('default').ingresses(''+name+'tv').delete();
            console.log("delete succesful!");
            response({"deployment":replace,"service":deleteService,"service":deleteServiceTV ,"ingess":deleteIngress, "ingressTV":deleteIngressTV});
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

app.get("/healthz", function (req, res) {
    res.status(200).json({msg: "Kid A: 1st track"});
});

app.delete("/", function (req, res){
    deletePod(req.query.name).then((response,reject)=>{
        if(reject) res.status(500).json({error: "Internal server error"});
        res.status(200).json({msg: response});
    });
});

app.listen(PORT,() => {
	console.log("Hello! API service running on port " + PORT);
});
