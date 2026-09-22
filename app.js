const express = require('express');
const path = require('path');
const cons = require('consolidate');
const fs = require('fs'); 
const app = express();

app.engine('mustache', cons.mustache);
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'cars.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the cars.json file:', err);
            res.status(500).send('Error reading the inventory data');
            return;
        }

        const cars = JSON.parse(data);
        res.render('inventory', { cars: cars });
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
#############
#### VPC ####
#############
module "core-vpc-sdwan" {
  source                          = "gitlab.x.il/net-vpc/gcp"
  version                         = "29.0.0"
  project_id                      = module.core-project.project_id
  name                            = "sdwan"
  delete_default_routes_on_create = true
  create_googleapis_routes = {
    private    = false
    restricted = false
  }
}

###############################################################################
#                               SD-WAN peering                                #
###############################################################################

module "peering-sdwan-dmz" {
  source        = "gitlab.x.il/net-vpc-peering/gcp"
  version       = "29.0.0"
  prefix        = var.prefix
  local_network = module.core-vpc-dmz.id
  peer_network  = module.core-vpc-sdwan.id
  routes_config = {
    local = {
      export        = true
      import        = true
      public_export = false
      public_import = false
    }
    peer = {
      export        = true
      import        = true
      public_export = false
      public_import = false
    }
  }
}

module "peering-sdwan-waf" {
  source        = "gitlab.x.il/net-vpc-peering/gcp"
  version       = "29.0.0"
  prefix        = var.prefix
  local_network = module.core-vpc-waf.id
  peer_network  = module.core-vpc-sdwan.id
  routes_config = {
    local = {
      export        = true
      import        = true
      public_export = false
      public_import = false
    }
    peer = {
      export        = true
      import        = true
      public_export = false
      public_import = false
    }
  }
}

module "sdwan-vpn-0" {
  source     = "gitlab.x.il/net-vpn-ha/gcp"
  version    = "29.0.0"
  project_id = module.core-project.name
  region     = var.region
  network    = module.core-vpc-sdwan.self_link
  name = "sdwan-vpn-0"
  peer_gateways = {
    default = {
      external = {
        redundancy_type = "TWO_IPS_REDUNDANCY"
        interfaces      = ["34.165.11.1", "34.165.28.2"] #    = ["8.8.8.8"] # on-prem router ip address
      }
    }
  }
  router_config = {
    asn = 64514
  }
  tunnels = {
    remote-a = {
      bgp_peer = {
        address = "169.254.30.38"
        asn     = 65413
        custom_advertise = {
          all_subnets          = true
          all_vpc_subnets      = false
          all_peer_vpc_subnets = false
          ip_ranges = {
            "100.64.0.0/10"             = "GCP Office Networks"
            "${var.ip_ranges.core-dmz}" = "DMZ Network"
          }
        }
      }
      bgp_session_range               = "169.254.30.37/30"
      peer_external_gateway_interface = 0
      shared_secret                   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      vpn_gateway_interface           = 0
    }
    remote-b = {
      bgp_peer = {
        address = "169.254.30.2"
        asn     = 65413
        custom_advertise = {
          all_subnets          = true
          all_vpc_subnets      = false
          all_peer_vpc_subnets = false
          ip_ranges = {
            "100.64.0.0/10"             = "GCP Office Networks"
            "${var.ip_ranges.core-dmz}" = "DMZ Network"
          }
        }
      }
      bgp_session_range               = "169.254.30.1/30"
      peer_external_gateway_interface = 1
      # peer_ip               = "34.165.28.30"
      shared_secret         = "afb1775b06fe78d5b912a96c98d114c3e3100a67"
      vpn_gateway_interface = 1
    }
  }
}
